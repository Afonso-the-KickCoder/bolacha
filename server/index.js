// Servidor: serve os ficheiros estaticos e corre o loop autoritativo do jogo via WebSocket.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { createGame, addPlayer, removePlayer, setInput, requestRestart, step, snapshot } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const TICK_HZ = 30;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// --- Servidor HTTP (ficheiros estaticos) ---
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
    // Impede sair da pasta public (path traversal).
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Proibido');
      return;
    }
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Nao encontrado');
  }
});

// --- WebSocket + loop do jogo ---
const wss = new WebSocketServer({ server });
const game = createGame();
let nextId = 1;

wss.on('connection', (socket) => {
  const id = String(nextId++);
  let joined = false;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignora mensagens invalidas
    }
    if (typeof msg !== 'object' || msg === null) return;

    switch (msg.type) {
      case 'join': {
        if (joined) return;
        addPlayer(game, id, typeof msg.name === 'string' ? msg.name : 'Jogador');
        joined = true;
        socket.send(JSON.stringify({ type: 'welcome', id }));
        break;
      }
      case 'input': {
        if (!joined) return;
        const dx = Number(msg.dx) || 0;
        const dy = Number(msg.dy) || 0;
        setInput(game, id, dx, dy, !!msg.jump);
        break;
      }
      case 'restart': {
        requestRestart(game);
        break;
      }
      default:
        break;
    }
  });

  socket.on('close', () => {
    if (joined) removePlayer(game, id);
  });
});

// Loop fixo: avanca a simulacao e envia o estado a todos.
let last = process.hrtime.bigint();
setInterval(() => {
  const now = process.hrtime.bigint();
  // Limita o dt: um hitch (event loop preso) nao deve produzir um passo de
  // fisica gigante que atravessa plataformas ou dispara a velocidade.
  const dt = Math.min(0.05, Number(now - last) / 1e9);
  last = now;

  step(game, dt);

  const payload = JSON.stringify({ type: 'state', ...snapshot(game) });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}, 1000 / TICK_HZ);

server.listen(PORT, () => {
  console.log(`Bolachas a correr em http://localhost:${PORT}`);
});
