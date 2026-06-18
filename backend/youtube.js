const { google } = require('googleapis');
const { Transform } = require('stream');
const db = require('./db');

const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/youtube/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const jobs = {};
let _jobSeq = 1;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClientForAccount(accountId) {
  const cfg = db.get().youtube_config;
  if (!cfg.client_id || !cfg.client_secret) return null;
  const account = cfg.accounts.find(a => a.id === accountId);
  if (!account?.refresh_token) return null;
  const auth = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, REDIRECT_URI);
  auth.setCredentials({ refresh_token: account.refresh_token });
  return auth;
}

// Returns all channels across accounts with CH-XX labels
function getAllChannels() {
  let seq = 1;
  const result = [];
  for (const account of db.get().youtube_config.accounts) {
    for (const ch of (account.channels || [])) {
      result.push({
        ...ch,
        label: `CH-${String(seq).padStart(2, '0')}`,
        accountId: account.id,
        accountEmail: account.email || account.id,
      });
      seq++;
    }
  }
  return result;
}

function findAccountForChannel(channelId) {
  for (const account of db.get().youtube_config.accounts) {
    if ((account.channels || []).find(ch => ch.id === channelId)) return account;
  }
  return null;
}

// ── OAuth ────────────────────────────────────────────────────────────────────

function getAuthUrl(clientId, clientSecret, accountId) {
  const auth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account consent', // forces account picker + refresh token
    scope: SCOPES,
    state: accountId || 'new',
  });
}

async function exchangeCode(code, state) {
  const data = db.get();
  const cfg = data.youtube_config;
  const auth = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, REDIRECT_URI);
  const { tokens } = await auth.getToken(code);

  let account = cfg.accounts.find(a => a.id === state);
  let accountId;

  if (account) {
    account.refresh_token = tokens.refresh_token || account.refresh_token;
    accountId = account.id;
  } else {
    accountId = 'account_' + Date.now();
    account = { id: accountId, email: '', refresh_token: tokens.refresh_token || '', channels: [] };
    cfg.accounts.push(account);
  }

  await db.save();
  return accountId;
}

async function fetchChannelsForAccount(accountId) {
  const data = db.get();
  const cfg = data.youtube_config;
  const account = cfg.accounts.find(a => a.id === accountId);
  if (!account) throw new Error('Conta não encontrada');

  const auth = makeClientForAccount(accountId);
  if (!auth) throw new Error('Conta sem token. Re-autentique.');

  // Fetch email
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const info = await oauth2.userinfo.get();
    account.email = info.data.email || '';
  } catch (_) {}

  // Fetch channels
  const yt = google.youtube({ version: 'v3', auth });
  const res = await yt.channels.list({ part: ['snippet', 'statistics'], mine: true, maxResults: 50 });
  account.channels = (res.data.items || []).map(ch => ({
    id: ch.id,
    title: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails?.default?.url || '',
    subscribers: ch.statistics?.subscriberCount || '0',
    custom_url: ch.snippet.customUrl || '',
  }));

  await db.save();
  return account;
}

async function removeAccount(accountId) {
  const data = db.get();
  data.youtube_config.accounts = data.youtube_config.accounts.filter(a => a.id !== accountId);
  await db.save();
}

// ── Drive download helper ────────────────────────────────────────────────────

function makeDriveClientForDownload() {
  const cfg = db.get().drive_config;
  if (!cfg.client_id || !cfg.client_secret || !cfg.refresh_token) return null;
  const auth = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, process.env.DRIVE_REDIRECT_URI || 'http://localhost:3001/api/drive/callback');
  auth.setCredentials({ refresh_token: cfg.refresh_token });
  return auth;
}

function extractDriveFileId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

// ── Upload ───────────────────────────────────────────────────────────────────

async function startUpload({ creativeId, title, description, privacyStatus, channelId, categoryId }) {
  const account = findAccountForChannel(channelId);
  if (!account) throw new Error('Canal não encontrado. Verifique os canais vinculados.');

  const jobId = `job_${_jobSeq++}`;
  jobs[jobId] = { status: 'pending', progress: 0, youtube_url: null, video_id: null, error: null };

  _doUpload(jobId, { creativeId, title, description, privacyStatus, channelId, categoryId, accountId: account.id })
    .catch(err => {
      jobs[jobId].status = 'error';
      jobs[jobId].error = err.message;
      console.error('[YouTube] Upload error:', err.message);
    });

  return jobId;
}

async function _doUpload(jobId, { creativeId, title, description, privacyStatus, channelId, categoryId, accountId }) {
  const data = db.get();
  const creative = data.creatives.find(c => c.id === creativeId);
  if (!creative) throw new Error('Criativo não encontrado');
  if (!creative.link_drive) throw new Error('Criativo sem link do Drive. Vincule o arquivo primeiro.');

  const fileId = extractDriveFileId(creative.link_drive);
  if (!fileId) throw new Error(`Não foi possível extrair o ID do Drive da URL: ${creative.link_drive}`);

  jobs[jobId].status = 'downloading';

  const driveAuth = makeDriveClientForDownload();
  if (!driveAuth) throw new Error('Drive não autenticado. Configure a integração com Drive primeiro.');

  const driveClient = google.drive({ version: 'v3', auth: driveAuth });

  let meta;
  try {
    meta = await driveClient.files.get({ fileId, fields: 'name,mimeType,size' });
  } catch (err) {
    throw new Error(`Erro ao acessar arquivo no Drive: ${err.message}`);
  }

  const mimeType = meta.data.mimeType || 'video/mp4';
  const totalBytes = parseInt(meta.data.size || '0');
  jobs[jobId].total_bytes = totalBytes;

  let fileStreamRes;
  try {
    fileStreamRes = await driveClient.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  } catch (err) {
    throw new Error(`Erro ao baixar arquivo do Drive: ${err.message}`);
  }

  jobs[jobId].status = 'uploading';

  let uploadedBytes = 0;
  const tracker = new Transform({
    transform(chunk, _enc, cb) {
      uploadedBytes += chunk.length;
      jobs[jobId].progress = totalBytes > 0
        ? Math.min(99, Math.round((uploadedBytes / totalBytes) * 100))
        : 0;
      cb(null, chunk);
    },
  });
  const bodyStream = fileStreamRes.data.pipe(tracker);

  const ytAuth = makeClientForAccount(accountId);
  if (!ytAuth) throw new Error('Conta YouTube sem autenticação válida.');

  const yt = google.youtube({ version: 'v3', auth: ytAuth });

  let uploadRes;
  try {
    uploadRes = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title || creative.criativo.replace(/\.[^.]+$/, ''),
          description: description || '',
          categoryId: categoryId || '22',
        },
        status: { privacyStatus: privacyStatus || 'private' },
      },
      media: { mimeType, body: bodyStream },
    });
  } catch (err) {
    throw new Error(`Erro no upload para o YouTube: ${err.message}`);
  }

  const videoId = uploadRes.data.id;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const idx = data.creatives.findIndex(c => c.id === creativeId);
  if (idx !== -1) {
    data.creatives[idx].youtube_url = youtubeUrl;
    data.creatives[idx].updated_at = new Date().toISOString();
  }

  const accountEntry = data.youtube_config.accounts.find(a => a.id === accountId);
  if (accountEntry) {
    accountEntry.upload_count = (accountEntry.upload_count || 0) + 1;
  }

  await db.save();

  jobs[jobId].status = 'done';
  jobs[jobId].progress = 100;
  jobs[jobId].youtube_url = youtubeUrl;
  jobs[jobId].video_id = videoId;
}

function getJob(jobId) {
  return jobs[jobId] || null;
}

module.exports = { getAuthUrl, exchangeCode, fetchChannelsForAccount, removeAccount, getAllChannels, startUpload, getJob };
