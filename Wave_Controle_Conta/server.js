const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// CORS — allow Wave Dashboard (dev + production) to call this local API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const CREATIVES_FILE = path.join(DATA_DIR, 'creatives.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: '', port: 50325 }, null, 2));
if (!fs.existsSync(CREATIVES_FILE)) fs.writeFileSync(CREATIVES_FILE, JSON.stringify({}, null, 2));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function adsHeaders(config) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  return headers;
}

function adsUrl(config, path) {
  return `http://localhost:${config.port}${path}`;
}

// ── AdsPower rate-limit queue ───────────────────────────────────────────────
// AdsPower rejects concurrent requests ("Too many request per second").
// This queue serialises all proxy calls and adds a 700ms gap between them.
let _adsChain = Promise.resolve();

function adsRequest(url, headers) {
  const result = _adsChain.then(() => fetch(url, { headers }));
  // Whether the request succeeds or fails, wait 700ms before the next one.
  _adsChain = result
    .catch(() => {})
    .then(() => new Promise(r => setTimeout(r, 1200)));
  return result;
}

// ── Config ─────────────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

app.post('/api/config', (req, res) => {
  const { apiKey = '', port = 50325 } = req.body;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey, port }, null, 2));
  res.json({ ok: true });
});

// ── AdsPower Proxy ──────────────────────────────────────────────────────────

app.get('/api/ads/groups', async (req, res) => {
  try {
    const config = readConfig();
    const url = adsUrl(config, '/api/v1/group/list?page=1&page_size=2000');
    const resp = await adsRequest(url, adsHeaders(config));
    res.json(await resp.json());
  } catch (err) {
    res.status(502).json({ code: -1, msg: `Não foi possível conectar ao AdsPower: ${err.message}` });
  }
});

app.get('/api/ads/profiles', async (req, res) => {
  try {
    const config = readConfig();
    const { page = 1, page_size = 100, group_id = '', tag_ids = '' } = req.query;
    const params = new URLSearchParams({ page, page_size });
    if (group_id) params.set('group_id', group_id);
    if (tag_ids)  params.set('tag_ids', tag_ids);
    const url = adsUrl(config, `/api/v1/user/list?${params}`);
    const resp = await adsRequest(url, adsHeaders(config));
    res.json(await resp.json());
  } catch (err) {
    res.status(502).json({ code: -1, msg: `Não foi possível conectar ao AdsPower: ${err.message}` });
  }
});

// Tags are embedded in profile objects (fbcc_user_tag field).
app.get('/api/ads/tags', async (req, res) => {
  try {
    const config = readConfig();
    const url = adsUrl(config, '/api/v1/tag/list?page=1&limit=200');
    const resp = await adsRequest(url, adsHeaders(config));
    if (!resp.ok) return res.json({ code: 0, data: { list: [] } });
    res.json(await resp.json());
  } catch {
    res.json({ code: 0, data: { list: [] } });
  }
});

// ── Creatives Storage ───────────────────────────────────────────────────────

app.get('/api/creatives', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(CREATIVES_FILE, 'utf-8')));
});

app.put('/api/creatives/:profileId', (req, res) => {
  const { profileId } = req.params;
  const { creatives = [], notes = '', campaigns = [], status = '' } = req.body;
  const data = JSON.parse(fs.readFileSync(CREATIVES_FILE, 'utf-8'));
  data[profileId] = { creatives, campaigns, notes, status, updatedAt: new Date().toISOString() };
  fs.writeFileSync(CREATIVES_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

app.delete('/api/creatives/:profileId', (req, res) => {
  const { profileId } = req.params;
  const data = JSON.parse(fs.readFileSync(CREATIVES_FILE, 'utf-8'));
  delete data[profileId];
  fs.writeFileSync(CREATIVES_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  Wave Controle Conta rodando em http://localhost:${PORT}\n`);
});
