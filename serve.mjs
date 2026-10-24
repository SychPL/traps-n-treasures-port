// Traps 'n Treasures: a minimal local web server for the game (Node 18+, no packages) - the same as serve.ps1.
//   node serve.mjs [port]      then open http://127.0.0.1:8435/game/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url)), port = +process.argv[2] || 8435;
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml'};
createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://x'), path = decodeURIComponent(url.pathname), file = normalize(join(root, path));
    if (!file.startsWith(root) && file + sep !== root) { res.writeHead(403).end(); return; }   // nothing outside this folder
    const s = await stat(file);
    if (s.isDirectory() && !path.endsWith('/')) { res.writeHead(301, {Location: url.pathname + '/' + url.search}).end(); return; }
    const f = s.isDirectory() ? join(file, 'index.html') : file, body = await readFile(f);
    res.writeHead(200, {'Content-Type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    if (!res.headersSent) res.writeHead(e instanceof URIError ? 400 : 404);
    res.end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Traps 'n Treasures: http://127.0.0.1:${port}/game/  (Ctrl+C stops the server)`));
