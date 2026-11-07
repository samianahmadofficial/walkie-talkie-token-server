# LiveKit token server — walkie-talkie map app (prototype)

A tiny server with one job: mint short-lived LiveKit access tokens so
phones can join a voice room. The app fetches a token from here
(`POST /token`) and never holds the LiveKit API secret itself — only
this server does.

## Run locally

```bash
cd token-server
npm install
npm start
```

Listens on `http://localhost:3001` (change `PORT` in `.env` if needed).

The server needs `token-server/.env` with:

```text
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=<key from LiveKit Cloud project settings>
LIVEKIT_API_SECRET=<secret from LiveKit Cloud project settings>
PORT=3001
```

These values already exist in the project's `.env` — if you are setting
up from scratch, copy `.env.example` to `.env` and fill it in. Never
commit `.env` or paste the secret into chat.

## Test it

Health check (no secrets needed):

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

Mint a token (example values only — use any room/identity/name):

```bash
curl -X POST http://localhost:3001/token \
  -H 'Content-Type: application/json' \
  -d '{"room":"walkie-49.89_-97.14","identity":"test-user-1","name":"Test User"}'
# {"token":"eyJhbGciOi..."}  (a long JWT string — that is the whole result)
```

A good response is HTTP 200 with a `token` that has three
dot-separated parts (`xxxxx.yyyyy.zzzzz`). Paste that token into
[jwt.io](https://jwt.io) to check it: the payload should show your
`room`, `identity` and `name`, plus `canPublish` / `canSubscribe`
permissions. Missing `room` or `identity` returns HTTP 400.

## Point the app at it

In the app's `.env` (`~/workspace/walkie-talkie-app/.env`):

```text
EXPO_PUBLIC_LIVEKIT_URL=wss://<your-project>.livekit.cloud
EXPO_PUBLIC_LIVEKIT_TOKEN_URL=http://localhost:3001/token
```

`localhost` only works while the phone and this computer share Wi-Fi
and the app runs in dev — for real phones on the road, the server has
to live on the public internet (below), and the URL becomes
`https://<your-host>/token`.

## Putting it on the public internet (hosting options)

The code is deployment-ready as-is; **nothing is deployed yet and no
hosting account has been created.** Pick one when you are ready:

1. **Render (free tier)** — easiest. Create a free Web Service from
   this `token-server/` folder (or the repo), build command
   `npm install`, start command `npm start`. Set the three env vars
   (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) in the
   Render dashboard — never in code. You get a public
   `https://<name>.onrender.com` URL. Note: the free tier sleeps after
   inactivity, so the first token request after a pause takes ~30s to
   wake up.
2. **Railway (free trial credit, then ~$5/mo)** — similar one-click
   deploy from the folder, env vars in the dashboard, public URL
   included. No sleeping, so the first request is instant. Costs a
   little once the trial credit runs out.
3. **Fly.io (free allowance)** — `fly launch` in this folder, set the
   env vars with `fly secrets set`, deploy with `fly deploy`. You get
   a public `https://<name>.fly.dev` URL. Slightly more setup than
   Render/Railway, but stays awake and the free allowance covers a
   tiny server like this.
4. **A small VPS (e.g. ~$5/mo)** — most control, most work: rent a
   server, install Node, run this folder with `pm2` or `systemd`,
   put it behind Caddy/nginx for HTTPS. Only worth it if you already
   run a server for something else.

Whichever you pick, the only thing the host needs is: Node 18+,
`npm install`, `npm start`, the three env vars above, and a public
HTTPS URL. Then set the app's `EXPO_PUBLIC_LIVEKIT_TOKEN_URL` to
`https://<your-host>/token` and restart Expo.

## What this does NOT do (by design, prototype scope)

- **No sign-in check before minting.** Anyone who can reach the URL
  can get a token for any room. A production version would first
  verify the caller is a signed-in app user (e.g. check a Supabase
  auth token) before minting — that check is NOT built here.
- **No rate limiting, no logging of who asked for what** — just an
  error line in the console if minting fails.
- **No deployment.** This folder is code only until someone picks a
  host above and deploys it.
