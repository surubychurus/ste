import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SerialPort } from 'serialport';
import { ReadlineParser } from 'serialport';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3001;
const BAUD = Number(process.env.BAUD) || 115200;
const FORCED_PORT = process.env.SERIAL_PORT || '';
const SIM = process.argv.includes('--sim') || process.env.SIM === '1';
const MICROBIT_VID = '0d28';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

// ---------- HTTP (sirve el build de Vite y una API mínima) ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/ports') {
    const ports = await SerialPort.list();
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(ports));
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(dist, rel));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end('Not found (¿ejecutaste "npm run build"? En desarrollo usa http://localhost:5173)');
  }
  res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws' });
let status = { type: 'status', state: 'waiting', port: null };
let last = null;

const broadcast = (msg) => {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
};
const setStatus = (state, port = null) => {
  status = { type: 'status', state, port };
  console.log(`[estado] ${state}${port ? ' · ' + port : ''}`);
  broadcast(status);
};

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(status));
  if (last) ws.send(JSON.stringify(last));
});

// ---------- Parser de líneas ----------
// Acepta: "temp:24,light:120,sound:60" · "t=24 l=120 s=60" · "24,120,60" · {"temp":24,"light":120}
const KEYS = {
  temp: /^(t|temp|temperatura|temperature)$/i,
  light: /^(l|luz|light|lux)$/i,
  sound: /^(s|snd|sonido|sound|mic|ruido|noise)$/i,
};
export function parseLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  const out = {};

  if (line.startsWith('{')) {
    try {
      const o = JSON.parse(line);
      for (const [k, v] of Object.entries(o)) {
        if (typeof v !== 'number') continue;
        if (KEYS.temp.test(k)) out.temp = v;
        else if (KEYS.light.test(k)) out.light = v;
        else if (KEYS.sound.test(k)) out.sound = v;
      }
    } catch { /* ignorar */ }
  } else {
    for (const m of line.matchAll(/([a-zA-Zñ_]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)/g)) {
      if (KEYS.temp.test(m[1])) out.temp = Number(m[2]);
      else if (KEYS.light.test(m[1])) out.light = Number(m[2]);
      else if (KEYS.sound.test(m[1])) out.sound = Number(m[2]);
    }
    if (out.temp === undefined && out.light === undefined) {
      const nums = line.match(/-?\d+(?:\.\d+)?/g);
      if (nums && nums.length >= 2) {
        out.temp = Number(nums[0]);
        out.light = Number(nums[1]);
        if (nums.length >= 3) out.sound = Number(nums[2]);
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

function emit(partial) {
  last = {
    type: 'reading',
    temp: partial.temp ?? last?.temp ?? null,
    light: partial.light ?? last?.light ?? null,
    sound: partial.sound ?? last?.sound ?? null,
    t: Date.now(),
  };
  broadcast(last);
}

// ---------- Puerto serial ----------
let current = null;

async function findPort() {
  if (FORCED_PORT) return FORCED_PORT;
  const list = await SerialPort.list();
  const mb = list.find((p) => p.vendorId?.toLowerCase() === MICROBIT_VID);
  return mb?.path ?? null;
}

async function connect() {
  if (SIM) return;
  let portPath;
  try {
    portPath = await findPort();
  } catch (e) {
    console.error('No pude listar puertos:', e.message);
  }
  if (!portPath) {
    if (status.state !== 'waiting') setStatus('waiting');
    return setTimeout(connect, 2000);
  }

  const port = new SerialPort({ path: portPath, baudRate: BAUD, autoOpen: false });
  current = port;
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  parser.on('data', (line) => {
    const r = parseLine(line);
    if (r) emit(r);
    else console.log('[ignorado]', line.trim());
  });

  const retry = () => {
    if (current !== port) return;
    current = null;
    setStatus('waiting');
    setTimeout(connect, 2000);
  };
  port.on('close', retry);
  port.on('error', (e) => console.error('[serial]', e.message));

  port.open((err) => {
    if (err) {
      console.error(`No pude abrir ${portPath}: ${err.message} (¿otro programa la está usando?)`);
      return retry();
    }
    setStatus('connected', portPath);
  });
}

// ---------- Simulación (sin micro:bit) ----------
function simulate() {
  setStatus('simulation', 'simulado');
  const t0 = Date.now();
  setInterval(() => {
    const s = (Date.now() - t0) / 1000;
    emit({
      temp: +(24 + Math.sin(s / 7) * 5 + Math.sin(s * 1.3) * 0.4).toFixed(1),
      light: Math.round(Math.min(255, Math.max(0, 128 + Math.sin(s / 4) * 110 + Math.random() * 10))),
      sound: Math.round(Math.min(255, Math.max(0, 50 + Math.sin(s / 2.3) * 40 + Math.random() * 70))),
    });
  }, 500);
}

server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT} (ws en /ws)`);
  SIM ? simulate() : connect();
});
