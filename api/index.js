import { server } from '../src/server.js';

// Vercel invokes this handler per request. No process-level listener is started.
// Proposals currently remain in function memory, so this is a temporary demo adapter.
export default function handler(req, res) {
  server.emit('request', req, res);
}
