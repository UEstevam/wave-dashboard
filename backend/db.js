const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_FILE = path.join(__dirname, 'wave_db.json');
const MONGO_URI = process.env.MONGODB_URI;
const DOC_ID = 'main_v1';

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  status: [
    { value: 'EM TESTE',   color: '#f59e0b' },
    { value: 'PRÉ ESCALA', color: '#15803d' },
    { value: 'ESCALA',     color: '#22c55e' },
    { value: 'RUIM',       color: '#ef4444' },
    { value: 'INICIAR',    color: '#9ca3af' },
    { value: 'REPROVADO',  color: '#475569' },
    { value: 'LIMITADO',   color: '#eab308' },
  ],
  tipo: [
    { value: 'NOVO',      color: '#3b82f6' },
    { value: 'REEDIÇÃO',  color: '#8b5cf6' },
    { value: 'ITERAÇÃO',  color: '#f97316' },
  ],
  gestor: [
    { value: 'Marcos', color: '#10b981' },
    { value: 'Hugo',   color: '#a855f7' },
  ],
  oferta: [
    { value: 'VSL 02 SlimTide', color: '#14b8a6' },
    { value: 'VSL 01 SlimTide', color: '#0ea5e9' },
    { value: 'VSL 03 SlimTide', color: '#8b5cf6' },
  ],
};

const DEFAULT_COLUMNS = [
  { key: 'ordem',       label: 'ORDEM',       type: 'text',     visible: true,  fixed: true,  width: 60,  selectCategory: null },
  { key: 'criativo',    label: 'CRIATIVO',    type: 'text',     visible: true,  fixed: true,  width: 280, selectCategory: null },
  { key: 'tipo',        label: 'TIPO',        type: 'select',   visible: true,  fixed: true,  width: 110, selectCategory: 'tipo' },
  { key: 'data',        label: 'DATA',        type: 'text',     visible: true,  fixed: true,  width: 100, selectCategory: null },
  { key: 'oferta',      label: 'OFERTA',      type: 'select',   visible: true,  fixed: true,  width: 160, selectCategory: 'oferta' },
  { key: 'status',      label: 'STATUS',      type: 'select',   visible: true,  fixed: true,  width: 120, selectCategory: 'status' },
  { key: 'gestor',      label: 'GESTOR',      type: 'select',   visible: true,  fixed: true,  width: 110, selectCategory: 'gestor' },
  { key: 'observacoes', label: 'OBSERVAÇÕES', type: 'text',     visible: true,  fixed: true,  width: 200, selectCategory: null },
  { key: 'num_vendas',  label: 'Nº VENDAS',  type: 'number',   visible: true,  fixed: true,  width: 80,  selectCategory: null },
  { key: 'cpa',         label: 'CPA',         type: 'currency', visible: true,  fixed: true,  width: 90,  selectCategory: null },
  { key: 'coluna1',     label: 'COL 1',       type: 'number',   visible: true,  fixed: false, width: 70,  selectCategory: null },
  { key: 'coluna2',     label: 'COL 2',       type: 'currency', visible: true,  fixed: false, width: 80,  selectCategory: null },
];

const DEFAULT_DB = {
  creatives: [],
  options: DEFAULT_OPTIONS,
  nextId: 1,
  columns_config: DEFAULT_COLUMNS,
  drive_config: {
    client_id: '', client_secret: '', refresh_token: '',
    folder_id: '', poll_interval_minutes: 15, last_synced: null,
    enabled: false, auto_status: 'EM TESTE', auto_gestor: '',
    auto_oferta: '', auto_tipo: '', imported_ids: [],
  },
  youtube_config: {
    client_id: '', client_secret: '',
    default_privacy: 'private', default_category_id: '22',
    accounts: [],
  },
};

// ── Migration ────────────────────────────────────────────────────────────────

function migrate(data) {
  data.options = DEFAULT_OPTIONS;

  if (!Array.isArray(data.columns_config)) data.columns_config = DEFAULT_COLUMNS;

  if (!data.drive_config) data.drive_config = { ...DEFAULT_DB.drive_config };
  if (!Array.isArray(data.drive_config.imported_ids)) data.drive_config.imported_ids = [];

  if (!data.youtube_config) {
    data.youtube_config = { ...DEFAULT_DB.youtube_config };
  } else if (!Array.isArray(data.youtube_config.accounts)) {
    const oldToken = data.youtube_config.refresh_token || '';
    const oldChannels = data.youtube_config.channels || [];
    data.youtube_config.accounts = oldToken
      ? [{ id: 'account_migrated', email: '', refresh_token: oldToken, channels: oldChannels }]
      : [];
    delete data.youtube_config.refresh_token;
    delete data.youtube_config.channels;
    delete data.youtube_config.selected_channel_id;
  }

  for (const c of data.creatives) {
    if (!('link_drive' in c)) c.link_drive = '';
    if (!('youtube_url' in c)) c.youtube_url = '';
    if (!('coluna1' in c)) c.coluna1 = null;
    if (!('coluna2' in c)) c.coluna2 = null;
    for (const col of data.columns_config) {
      if (!col.fixed && !(col.key in c)) c[col.key] = null;
    }
  }

  return data;
}

// ── In-memory state ──────────────────────────────────────────────────────────

let _db = null;
let _col = null; // MongoDB collection (null in dev/JSON mode)

// ── MongoDB mode ─────────────────────────────────────────────────────────────

async function initMongo() {
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });
  await client.connect();
  const mdb = client.db(); // DB name comes from the URI
  _col = mdb.collection('app_data');
  console.log('[DB] MongoDB connected');

  const doc = await _col.findOne({ _id: DOC_ID });
  if (!doc) {
    _db = { ...DEFAULT_DB };
    _db.nextId = 1;
    await _col.insertOne({ _id: DOC_ID, ..._db });
    console.log('[DB] Fresh database created');
  } else {
    const { _id, ...data } = doc;
    _db = migrate(data);
    await _col.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ..._db }, { upsert: true });
    console.log(`[DB] Loaded — ${_db.creatives.length} creatives`);
  }
}

// ── JSON file mode (local dev fallback) ──────────────────────────────────────

function initFile() {
  if (!fs.existsSync(DB_FILE)) {
    _db = { ...DEFAULT_DB, nextId: 1 };
    fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8');
  } else {
    _db = migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8');
  }
  console.log('[DB] JSON file mode');
}

// ── Public API ───────────────────────────────────────────────────────────────

async function init() {
  if (MONGO_URI) {
    await initMongo();
  } else {
    initFile();
  }
}

function get() {
  return _db;
}

function save() {
  if (_col) {
    _col.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ..._db }, { upsert: true })
      .catch(err => console.error('[DB] Save error:', err.message));
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8');
  }
}

function nextId() {
  const id = _db.nextId;
  _db.nextId++;
  save();
  return id;
}

const db = { init, get, save, nextId };
module.exports = db;
module.exports.DEFAULT_COLUMNS = DEFAULT_COLUMNS;
