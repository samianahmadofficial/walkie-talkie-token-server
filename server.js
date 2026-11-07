// LiveKit token server — walkie-talkie map app (prototype).
//
// Tiny server with one job: mint short-lived LiveKit access tokens
// so phones can join a voice room. The app never holds the API
// secret — only this server does (from token-server/.env).
//
// Endpoints:
//   GET  /health -> { "status": "ok" }          (no secrets needed)
//   POST /token  { room, identity, name } -> { token }
//
// Run:  npm install && npm start   (listens on PORT from .env, default 3001)
//
// SECURITY NOTE (prototype): this mints a token for anyone who asks.
// A production version would first check the caller is a signed-in
// app user (e.g. verify a Supabase auth token) before minting.
// That check is intentionally NOT in scope for the prototype.

const http = require('node:http');
const { AccessToken } = require('livekit-server-sdk');

require('dotenv').config();

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const PORT = Number(process.env.PORT || 3001);

if (!API_KEY || !API_SECRET) {
  console.error(
    'Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET. Copy .env.example to .env ' +
      'and fill in the LiveKit Cloud project values (see README.md).',
  );
  process.exit(1);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'POST' && req.url === '/token') {
      const body = await readJsonBody(req);
      const room = typeof body.room === 'string' ? body.room.trim() : '';
      const identity = typeof body.identity === 'string' ? body.identity.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : identity;

      if (!room || !identity) {
        sendJson(res, 400, { error: 'room and identity are required' });
        return;
      }

      // One token per caller: they may join this room, publish their
      // mic, and hear everyone else in it. Tokens expire after 6h.
      const token = new AccessToken(API_KEY, API_SECRET, {
        identity,
        name: name || identity,
        ttl: '6h',
      });
      token.addGrant({
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      sendJson(res, 200, { token: await token.toJwt() });
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('Token request failed:', err.message);
    sendJson(res, 500, { error: 'failed to mint token' });
  }
});

server.listen(PORT, () => {
  console.log(`LiveKit token server listening on http://localhost:${PORT}`);
  console.log('  GET  /health  -> { "status": "ok" }');
  console.log('  POST /token   { room, identity, name } -> { token }');
});
