const express = require('express');
const cors = require('cors');
const db = require('./db');
const DEFAULT_COLUMNS = db.DEFAULT_COLUMNS;
const drive = require('./google-drive');
const youtube = require('./youtube');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:5173']
    : true,
  credentials: true,
}));
app.use(express.json());

// ── Helpers ────────────────────────────────────────────────────────────────

function matchesFilter(c, { search, status, gestor, oferta, tipo }) {
  if (search) {
    const s = search.toLowerCase();
    if (!c.criativo.toLowerCase().includes(s) && !c.ordem.includes(s) && !c.observacoes.toLowerCase().includes(s)) return false;
  }
  if (status && c.status !== status) return false;
  if (gestor && c.gestor !== gestor) return false;
  if (oferta && c.oferta !== oferta) return false;
  if (tipo   && c.tipo   !== tipo)   return false;
  return true;
}

// ── Creatives ──────────────────────────────────────────────────────────────

app.get('/api/creatives', (req, res) => {
  const data = db.get();
  const filters = req.query;
  let list = data.creatives.filter(c => matchesFilter(c, filters));
  list.sort((a, b) => parseInt(a.ordem) - parseInt(b.ordem) || a.id - b.id);
  res.json(list);
});

app.post('/api/creatives', (req, res) => {
  const data = db.get();
  const now = new Date().toISOString();
  const { ordem, criativo, tipo, data: dateVal, oferta, status, gestor, observacoes, num_vendas, cpa, coluna1, coluna2, link_drive } = req.body;

  let finalOrdem = ordem;
  if (!finalOrdem) {
    const maxOrdem = data.creatives.reduce((m, c) => Math.max(m, parseInt(c.ordem) || 0), 0);
    finalOrdem = String(maxOrdem + 1).padStart(3, '0');
  }

  const newCreative = {
    id: db.nextId(),
    ordem: finalOrdem,
    criativo: criativo || '',
    tipo: tipo || '',
    data: dateVal || '',
    oferta: oferta || '',
    status: status || 'EM TESTE',
    gestor: gestor || '',
    observacoes: observacoes || '',
    num_vendas: num_vendas || 0,
    cpa: cpa || 0,
    coluna1: coluna1 ?? null,
    coluna2: coluna2 ?? null,
    link_drive: link_drive || '',
    created_at: now,
    updated_at: now,
  };

  data.creatives.push(newCreative);
  db.save();
  res.status(201).json(newCreative);
});

app.put('/api/creatives/:id', (req, res) => {
  const data = db.get();
  const id = parseInt(req.params.id);
  const idx = data.creatives.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const PROTECTED = new Set(['id', 'created_at', 'updated_at']);
  for (const [field, value] of Object.entries(req.body)) {
    if (!PROTECTED.has(field)) data.creatives[idx][field] = value;
  }
  data.creatives[idx].updated_at = new Date().toISOString();
  db.save();
  res.json(data.creatives[idx]);
});

app.delete('/api/creatives/:id', (req, res) => {
  const data = db.get();
  const id = parseInt(req.params.id);
  data.creatives = data.creatives.filter(c => c.id !== id);
  db.save();
  res.status(204).send();
});

app.post('/api/creatives/bulk-delete', (req, res) => {
  const data = db.get();
  const ids = new Set((req.body.ids || []).map(Number));
  if (!ids.size) return res.status(400).json({ error: 'No ids provided' });
  data.creatives = data.creatives.filter(c => !ids.has(c.id));
  db.save();
  res.status(204).send();
});

// ── Options ────────────────────────────────────────────────────────────────

app.get('/api/options', (req, res) => {
  res.json(db.get().options);
});

app.post('/api/options', (req, res) => {
  const data = db.get();
  const { category, value, color } = req.body;
  if (!data.options[category]) data.options[category] = [];
  if (!data.options[category].find(o => o.value === value)) {
    data.options[category].push({ value, color: color || '#6b7280' });
    db.save();
  }
  res.status(201).json({ category, value, color });
});

app.delete('/api/options/:category/:value', (req, res) => {
  const data = db.get();
  const { category, value } = req.params;
  if (data.options[category]) {
    data.options[category] = data.options[category].filter(o => o.value !== decodeURIComponent(value));
    db.save();
  }
  res.status(204).send();
});

// ── Stats ──────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const creatives = db.get().creatives;
  const totalVendas = creatives.reduce((s, c) => s + (c.num_vendas || 0), 0);
  const cpas = creatives.filter(c => c.cpa > 0).map(c => c.cpa);
  const cpaMedia = cpas.length ? cpas.reduce((s, v) => s + v, 0) / cpas.length : 0;

  res.json({
    total: creatives.length,
    emTeste: creatives.filter(c => c.status === 'EM TESTE').length,
    ativo: creatives.filter(c => c.status === 'ATIVO').length,
    totalVendas,
    cpaMedia: Math.round(cpaMedia * 100) / 100,
    novos: creatives.filter(c => c.tipo === 'NOVO').length,
  });
});

// ── Columns CRUD ───────────────────────────────────────────────────────────

app.get('/api/columns', (req, res) => {
  res.json(db.get().columns_config || DEFAULT_COLUMNS);
});

// Replace entire columns array (used for reorder, rename, visibility toggle)
app.put('/api/columns', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected array' });
  const data = db.get();
  data.columns_config = req.body;
  db.save();
  res.json(data.columns_config);
});

// Add a new custom column
app.post('/api/columns', (req, res) => {
  const { label, type } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  const data = db.get();
  const cols = data.columns_config || DEFAULT_COLUMNS;
  const key = 'custom_' + Date.now();
  const newCol = { key, label, type: type || 'text', visible: true, fixed: false, width: 120, selectCategory: null };
  cols.push(newCol);
  data.columns_config = cols;
  for (const c of data.creatives) c[key] = null;
  db.save();
  res.status(201).json(newCol);
});

// Delete a custom column
app.delete('/api/columns/:key', (req, res) => {
  const { key } = req.params;
  const data = db.get();
  const cols = data.columns_config || DEFAULT_COLUMNS;
  const col = cols.find(c => c.key === key);
  if (!col) return res.status(404).json({ error: 'Not found' });
  if (col.fixed) return res.status(400).json({ error: 'Cannot delete fixed columns' });
  data.columns_config = cols.filter(c => c.key !== key);
  for (const c of data.creatives) delete c[key];
  db.save();
  res.status(204).send();
});

// ── Google Drive integration ───────────────────────────────────────────────

// Get current Drive config (never expose tokens to frontend)
app.get('/api/drive/config', (req, res) => {
  const { client_id, client_secret, refresh_token, folder_id, poll_interval_minutes, last_synced, enabled, auto_status, auto_gestor, auto_oferta, auto_tipo, imported_ids } = db.get().drive_config;
  res.json({
    client_id, folder_id, poll_interval_minutes, last_synced, enabled,
    auto_status, auto_gestor, auto_oferta, auto_tipo,
    is_authenticated: !!refresh_token,
    has_credentials: !!(client_id && client_secret),
    imported_count: (imported_ids || []).length,
    callback_url: process.env.DRIVE_REDIRECT_URI || 'http://localhost:3001/api/drive/callback',
  });
});

// Save credentials + settings (does NOT overwrite refresh_token)
app.put('/api/drive/config', (req, res) => {
  const data = db.get();
  const cfg = data.drive_config;
  const allowed = ['client_id', 'client_secret', 'folder_id', 'poll_interval_minutes', 'enabled', 'auto_status', 'auto_gestor', 'auto_oferta', 'auto_tipo'];
  for (const key of allowed) {
    if (key in req.body) cfg[key] = req.body[key];
  }
  db.save();
  drive.restartPolling();
  res.json({ ok: true });
});

// Generate OAuth URL so user can authenticate
app.get('/api/drive/auth-url', (req, res) => {
  const { client_id, client_secret } = db.get().drive_config;
  if (!client_id || !client_secret) return res.status(400).json({ error: 'Set client_id and client_secret first' });
  try {
    const url = drive.getAuthUrl(client_id, client_secret);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OAuth callback — exchange code for tokens
app.get('/api/drive/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    await drive.exchangeCode(code);
    drive.startPolling();
    res.send(`
      <html><body style="font-family:sans-serif;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2 style="color:#22c55e">✓ Autenticação concluída!</h2>
          <p>Pode fechar esta aba e voltar ao dashboard.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`Erro: ${err.message}`);
  }
});

// Disconnect (remove tokens)
app.post('/api/drive/disconnect', (req, res) => {
  const data = db.get();
  data.drive_config.refresh_token = '';
  data.drive_config.enabled = false;
  db.save();
  drive.stopPolling();
  res.json({ ok: true });
});

// Manual sync
app.post('/api/drive/sync', async (req, res) => {
  try {
    const result = await drive.syncNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube integration ────────────────────────────────────────────────────

app.get('/api/youtube/config', (req, res) => {
  const cfg = db.get().youtube_config;
  const allChannels = youtube.getAllChannels();
  // Attach CH-XX labels to accounts for display
  const accounts = cfg.accounts.map(a => ({
    id: a.id,
    email: a.email || a.id,
    upload_count: a.upload_count || 0,
    channels: allChannels.filter(ch => ch.accountId === a.id),
  }));
  res.json({
    client_id: cfg.client_id,
    has_credentials: !!(cfg.client_id && cfg.client_secret),
    default_privacy: cfg.default_privacy,
    default_category_id: cfg.default_category_id,
    accounts,
    all_channels: allChannels,
  });
});

app.put('/api/youtube/config', (req, res) => {
  const data = db.get();
  const cfg = data.youtube_config;
  const allowed = ['client_id', 'client_secret', 'default_privacy', 'default_category_id'];
  for (const key of allowed) {
    if (key in req.body) cfg[key] = req.body[key];
  }
  db.save();
  res.json({ ok: true });
});

// Generate OAuth URL — optionally for re-authenticating an existing account
app.get('/api/youtube/auth-url', (req, res) => {
  const cfg = db.get().youtube_config;
  const { client_id, client_secret } = cfg;
  if (!client_id || !client_secret) return res.status(400).json({ error: 'Defina client_id e client_secret antes' });
  const accountId = req.query.accountId || 'new';
  try {
    res.json({ url: youtube.getAuthUrl(client_id, client_secret, accountId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const accountId = await youtube.exchangeCode(code, state);
    // Fetch channels and email immediately after auth
    try { await youtube.fetchChannelsForAccount(accountId); } catch (_) {}
    res.send(`
      <html><body style="font-family:sans-serif;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <div style="font-size:48px">▶</div>
          <h2 style="color:#ff4444;margin:8px 0">Conta Google vinculada!</h2>
          <p style="color:#94a3b8">Pode fechar esta aba e voltar ao dashboard.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`<html><body style="background:#0f1117;color:#f87171;font-family:sans-serif;padding:40px">Erro: ${err.message}</body></html>`);
  }
});

// Refresh channels for a specific account
app.post('/api/youtube/accounts/:accountId/refresh', async (req, res) => {
  try {
    const account = await youtube.fetchChannelsForAccount(req.params.accountId);
    res.json({ ok: true, channels: account.channels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove an account
app.delete('/api/youtube/accounts/:accountId', (req, res) => {
  youtube.removeAccount(req.params.accountId);
  res.json({ ok: true });
});

app.post('/api/youtube/upload', async (req, res) => {
  const { creativeId, title, description, privacyStatus, channelId, categoryId } = req.body;
  if (!creativeId) return res.status(400).json({ error: 'creativeId obrigatório' });
  if (!channelId) return res.status(400).json({ error: 'channelId obrigatório' });
  try {
    const jobId = await youtube.startUpload({ creativeId, title, description, privacyStatus, channelId, categoryId });
    res.json({ jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/upload-status/:jobId', (req, res) => {
  const job = youtube.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json(job);
});

// ── Startup ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Wave Dashboard API → http://localhost:${PORT}`);
      drive.startPolling();
    });
  })
  .catch(err => {
    console.error('[FATAL] Failed to initialize database:', err.message);
    process.exit(1);
  });
