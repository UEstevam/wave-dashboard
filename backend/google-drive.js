const { google } = require('googleapis');
const db = require('./db');

const REDIRECT_URI = process.env.DRIVE_REDIRECT_URI || 'http://localhost:3001/api/drive/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// Video/image file extensions to import
const MEDIA_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|gif|png|jpg|jpeg|heic|heif)$/i;

let _pollTimer = null;

// ── OAuth2 helpers ──────────────────────────────────────────────────────────

function makeClient(cfg = null) {
  const config = cfg || db.get().drive_config;
  if (!config.client_id || !config.client_secret) return null;
  const auth = new google.auth.OAuth2(config.client_id, config.client_secret, REDIRECT_URI);
  if (config.refresh_token) {
    auth.setCredentials({ refresh_token: config.refresh_token });
  }
  return auth;
}

function getAuthUrl(clientId, clientSecret) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

async function exchangeCode(code) {
  const data = db.get();
  const cfg = data.drive_config;
  const auth = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, REDIRECT_URI);
  const { tokens } = await auth.getToken(code);
  cfg.refresh_token = tokens.refresh_token || cfg.refresh_token;
  db.save();
  return tokens;
}

// ── Drive file fetching ─────────────────────────────────────────────────────

async function listItemsInFolder(folderId, auth) {
  const drive = google.drive({ version: 'v3', auth });
  const items = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, createdTime, size)',
      pageSize: 200,
      pageToken: pageToken || undefined,
      orderBy: 'createdTime desc',
    });
    items.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return items;
}

// Collect all media files recursively up to 2 levels deep.
// Returns array of { file, pasta_origem } where pasta_origem is the subfolder name ('' = root).
async function collectMediaFiles(rootFolderId, auth) {
  const items = await listItemsInFolder(rootFolderId, auth);
  const result = [];

  for (const item of items) {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      // It's a subfolder — list its contents
      const subItems = await listItemsInFolder(item.id, auth);
      for (const sub of subItems) {
        if (MEDIA_EXTENSIONS.test(sub.name)) {
          result.push({ file: sub, pasta_origem: item.name });
        }
      }
    } else if (MEDIA_EXTENSIONS.test(item.name)) {
      // Direct file in root folder
      result.push({ file: item, pasta_origem: '' });
    }
  }

  return result;
}

// ── Sync logic ──────────────────────────────────────────────────────────────

async function syncNow() {
  const data = db.get();
  const cfg = data.drive_config;

  if (!cfg.refresh_token) {
    return { skipped_reason: 'Não autenticado. Clique em "Autenticar com Google" no painel.' };
  }
  if (!cfg.folder_id) {
    return { skipped_reason: 'ID da pasta não configurado. Preencha o campo "Pasta do Drive" e salve.' };
  }
  if (!cfg.enabled) {
    return { skipped_reason: 'Sync desativado. Salve as configurações para ativar.' };
  }

  const auth = makeClient(cfg);
  if (!auth) return { skipped_reason: 'Credenciais inválidas.' };

  let mediaFiles;
  try {
    mediaFiles = await collectMediaFiles(cfg.folder_id, auth);
  } catch (err) {
    console.error('[Drive] List error:', err.message);
    return { error: `Erro ao listar pasta: ${err.message}` };
  }

  const imported = [];
  const skipped = [];

  for (const { file, pasta_origem } of mediaFiles) {
    if (cfg.imported_ids.includes(file.id)) { skipped.push(file.name); continue; }

    const exists = data.creatives.find(c => c.criativo === file.name);
    if (exists) {
      if (!exists.link_drive) exists.link_drive = file.webViewLink;
      if (!exists.pasta_origem && pasta_origem) exists.pasta_origem = pasta_origem;
      cfg.imported_ids.push(file.id);
      skipped.push(file.name);
      continue;
    }

    const maxOrdem = data.creatives.reduce((m, c) => Math.max(m, parseInt(c.ordem) || 0), 0);
    const nextOrdem = String(maxOrdem + 1).padStart(3, '0');
    const createdDate = file.createdTime
      ? new Date(file.createdTime).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    const newCreative = {
      id: db.nextId(),
      ordem: nextOrdem,
      criativo: file.name,
      tipo: cfg.auto_tipo || '',
      data: createdDate,
      oferta: cfg.auto_oferta || '',
      status: cfg.auto_status || 'EM TESTE',
      gestor: cfg.auto_gestor || '',
      observacoes: '',
      num_vendas: 0,
      cpa: 0,
      coluna1: null,
      coluna2: null,
      link_drive: file.webViewLink || '',
      pasta_origem,
      youtube_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    data.creatives.push(newCreative);
    cfg.imported_ids.push(file.id);
    imported.push(pasta_origem ? `[${pasta_origem}] ${file.name}` : file.name);
  }

  cfg.last_synced = new Date().toISOString();
  db.save();

  console.log(`[Drive] Sync done — ${imported.length} imported, ${skipped.length} skipped`);
  return { imported, skipped, total: mediaFiles.length };
}

// ── Polling ─────────────────────────────────────────────────────────────────

function startPolling() {
  stopPolling();
  const data = db.get();
  const cfg = data.drive_config;
  if (!cfg.enabled || !cfg.refresh_token) return;

  const intervalMs = (cfg.poll_interval_minutes || 15) * 60 * 1000;
  console.log(`[Drive] Polling started — every ${cfg.poll_interval_minutes} min`);

  _pollTimer = setInterval(async () => {
    console.log('[Drive] Auto-sync triggered');
    await syncNow();
  }, intervalMs);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function restartPolling() {
  stopPolling();
  startPolling();
}

module.exports = { getAuthUrl, exchangeCode, syncNow, startPolling, stopPolling, restartPolling };
