/* ── State ──────────────────────────────────────────────────── */
const state = {
  profiles: [],
  allProfiles: [],
  groups: [],
  tagMap: {},
  creatives: {},
  displayPage: 1,
  displayPageSize: 100,
  apiPageSize: 200,
  filters: { search: '', groupId: '', tagId: '', creativesFilter: '', status: '' },
  loading: false,
};

/* ── DOM refs ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const profilesBody    = $('profilesBody');
const tableWrap       = $('tableWrap');
const emptyState      = $('emptyState');
const loadingState    = $('loadingState');
const pagination      = $('pagination');
const groupFilter     = $('groupFilter');
const tagFilter       = $('tagFilter');
const creativesFilter = $('creativesFilter');
const statusFilter    = $('statusFilter');
const searchInput     = $('searchInput');
const settingsModal   = $('settingsModal');
const connectionBadge = $('connectionStatus');
const toast           = $('toast');
let toastTimer        = null;

/* ── Toast ───────────────────────────────────────────────────── */
function showToast(msg, type = 'default', duration = 2500) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

/* ── API calls ───────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadGroups() {
  const data = await api('/api/ads/groups');
  if (data.code !== 0) throw new Error(data.msg);
  state.groups = data.data?.list || [];
  rebuildGroupFilter();
}

async function fetchProfilePage(page) {
  const params = new URLSearchParams({ page, page_size: state.apiPageSize });
  if (state.filters.groupId) params.set('group_id', state.filters.groupId);
  const data = await api(`/api/ads/profiles?${params}`);
  if (data.code !== 0) throw new Error(data.msg);
  return data.data?.list || [];
}

async function loadProfiles() {
  const firstPage = await fetchProfilePage(1);
  state.allProfiles = [...firstPage];
  applyDisplayPage();
  extractTagsFromProfiles();

  if (firstPage.length === state.apiPageSize) {
    let page = 2;
    while (true) {
      const batch = await fetchProfilePage(page);
      if (!batch.length) break;
      state.allProfiles = [...state.allProfiles, ...batch];
      extractTagsFromProfiles();
      if (batch.length < state.apiPageSize) break;
      page++;
    }
    applyDisplayPage();
  }
}

function applyDisplayPage() {
  const start = (state.displayPage - 1) * state.displayPageSize;
  state.profiles = state.allProfiles.slice(start, start + state.displayPageSize);
}

async function loadCreatives() {
  state.creatives = await api('/api/creatives');
}

async function saveCreative(profileId, creatives, notes, campaigns = [], status = '') {
  await api(`/api/creatives/${profileId}`, {
    method: 'PUT',
    body: JSON.stringify({ creatives, notes, campaigns, status }),
  });
}

/* ── Tag extraction ──────────────────────────────────────────── */
function getProfileTagObjects(profile) {
  const raw = profile.fbcc_user_tag || [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(t => {
    if (typeof t === 'object') return { id: String(t.id), name: t.name, color: t.color || 'blue' };
    return { id: String(t), name: String(t), color: 'blue' };
  }).filter(t => t.name);
}

function extractTagsFromProfiles() {
  const byId = {};
  state.allProfiles.forEach(p => {
    getProfileTagObjects(p).forEach(t => { byId[t.id] = t; });
  });
  state.tagMap = byId;
  rebuildTagFilter();
}

/* ── Filter options ──────────────────────────────────────────── */
function rebuildGroupFilter() {
  const current = groupFilter.value;
  groupFilter.innerHTML = '<option value="">Todos os grupos</option>';
  state.groups.forEach(g => {
    const o = document.createElement('option');
    o.value = g.group_id;
    o.textContent = g.group_name;
    groupFilter.appendChild(o);
  });
  if (current) groupFilter.value = current;
}

function rebuildTagFilter() {
  const current = tagFilter.value;
  tagFilter.innerHTML = '<option value="">Todas as tags</option>';
  Object.values(state.tagMap)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(tag => {
      const o = document.createElement('option');
      o.value = tag.id;
      o.textContent = tag.name;
      tagFilter.appendChild(o);
    });
  if (current) tagFilter.value = current;
}

/* ── Stats bar ───────────────────────────────────────────────── */
function updateStats() {
  $('statProfiles').textContent      = state.allProfiles.length;
  $('statGroups').textContent        = state.groups.length;
  $('statTags').textContent          = Object.keys(state.tagMap).length;
  $('statWithCreatives').textContent = Object.values(state.creatives)
    .filter(c => c.creatives?.length > 0).length;
}

/* ── Connection badge ────────────────────────────────────────── */
function setConnected(ok) {
  connectionBadge.className = `connection-badge ${ok ? 'connected' : 'disconnected'}`;
  connectionBadge.innerHTML = `<span class="dot"></span> ${ok ? 'Conectado' : 'Desconectado'}`;
}

/* ── Time formatting ─────────────────────────────────────────── */
function formatTime(ts) {
  if (!ts || ts === '0') return { text: '—', cls: 'none' };
  const ms = String(ts).length === 10 ? Number(ts) * 1000 : Number(ts);
  if (!ms) return { text: '—', cls: 'none' };
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return { text: 'Agora', cls: 'recent' };
  if (mins < 60)  return { text: `${mins}m`, cls: 'recent' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return { text: `${hrs}h`, cls: 'recent' };
  const days = Math.floor(hrs / 24);
  if (days <= 7)  return { text: `${days}d`, cls: 'medium' };
  if (days <= 30) return { text: `${days}d`, cls: 'old' };
  const label = new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return { text: label, cls: 'ancient' };
}

/* ── HTML escaping ───────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Campaign start date extraction ─────────────────────────── */
// Matches: AP2955 - 27-06-[...] → captures day=27, month=06
const CAMPAIGN_DATE_RE = /^[A-Za-z]+\d+\s*-\s*(\d{1,2})-(\d{1,2})/;

function extractStartDate(campaigns) {
  if (!campaigns || !campaigns.length) return null;
  const now = new Date();
  const thisYear = now.getFullYear();
  let earliest = null;

  for (const name of campaigns) {
    const m = String(name).trim().match(CAMPAIGN_DATE_RE);
    if (!m) continue;
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10) - 1; // 0-indexed
    let date = new Date(thisYear, mon, day, 0, 0, 0, 0);
    // If the date is still in the future it must be from the previous year
    if (date > now) date = new Date(thisYear - 1, mon, day, 0, 0, 0, 0);
    if (!earliest || date < earliest) earliest = date;
  }
  return earliest;
}

function calcDaysActive(campaigns) {
  const start = extractStartDate(campaigns);
  if (start === null) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - s) / 86400000));
}

function buildDaysActiveCell(campaigns) {
  const start = extractStartDate(campaigns);
  if (!start) return null;

  const days = calcDaysActive(campaigns);
  const dd = String(start.getDate()).padStart(2, '0');
  const mm = String(start.getMonth() + 1).padStart(2, '0');

  const wrap = document.createElement('div');
  wrap.className = 'days-active-cell';

  const dateSpan = document.createElement('span');
  dateSpan.className = 'days-start-label';
  dateSpan.textContent = `Início ${dd}/${mm}`;
  wrap.appendChild(dateSpan);

  const badge = document.createElement('span');
  let cls = 'days-today';
  if (days >= 7)      cls = 'days-milestone';
  else if (days >= 4) cls = 'days-mid';
  else if (days >= 1) cls = 'days-new';

  const label = days === 0 ? 'Hoje'
    : days === 1 ? '1 dia'
    : `${days} dias`;

  badge.className = `days-badge ${cls}`;
  badge.textContent = days >= 7 ? `★ ${label}` : label;
  badge.title = `${days} dia${days !== 1 ? 's' : ''} desde ${dd}/${mm}`;
  wrap.appendChild(badge);

  return wrap;
}

/* ── Status helpers ──────────────────────────────────────────── */
const STATUS_LABELS = {
  ativa:      'Ativa',
  suspensa:   'Suspensa',
  em_revisao: 'Em revisão',
  banida:     'Banida',
};

function statusBadgeHtml(status) {
  if (!status) return '<span class="status-none">—</span>';
  const label = STATUS_LABELS[status] || status;
  return `<span class="status-badge status-${escHtml(status)}">${escHtml(label)}</span>`;
}

/* ── Drawer list editor ──────────────────────────────────────── */
function buildDrawerList(items, placeholder) {
  const wrap = document.createElement('div');
  wrap.className = 'drawer-list';

  function render(vals) {
    wrap.innerHTML = '';
    vals.forEach(val => {
      const row = document.createElement('div');
      row.className = 'drawer-list-row';

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'drawer-list-input';
      inp.value = val;
      inp.placeholder = placeholder || 'Digite aqui…';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'drawer-list-delete';
      del.title = 'Remover';
      del.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      del.addEventListener('click', () => inp.closest('.drawer-list-row').remove());

      row.appendChild(inp);
      row.appendChild(del);
      wrap.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'drawer-list-add';
    addBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar`;
    addBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'drawer-list-row';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'drawer-list-input';
      inp.placeholder = placeholder || 'Digite aqui…';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'drawer-list-delete';
      del.title = 'Remover';
      del.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      del.addEventListener('click', () => inp.closest('.drawer-list-row').remove());
      row.appendChild(inp);
      row.appendChild(del);
      addBtn.before(row);
      inp.focus();
    });
    wrap.appendChild(addBtn);
  }

  render(items);
  wrap.getItems = () => Array.from(wrap.querySelectorAll('.drawer-list-input'))
    .map(inp => inp.value.trim()).filter(Boolean);
  return wrap;
}

/* ── Drawer ──────────────────────────────────────────────────── */
let drawerProfile       = null;
let drawerCreativesList = null;
let drawerCampaignsList = null;

function openDrawer(profile) {
  drawerProfile = profile;
  const data = state.creatives[profile.user_id] || { creatives: [], campaigns: [], notes: '', status: '' };

  $('drawerProfileName').textContent = profile.name || '—';
  $('drawerProfileId').textContent   = profile.user_id || '';
  $('drawerStatus').value            = data.status || '';
  $('drawerNotes').value             = data.notes  || '';

  const cWrap = $('drawerCreativesList');
  cWrap.innerHTML = '';
  drawerCreativesList = buildDrawerList(data.creatives || [], 'Ex: MM2AD63-H1-NH3-VV3-COPY-RB');
  cWrap.appendChild(drawerCreativesList);

  const pWrap = $('drawerCampaignsList');
  pWrap.innerHTML = '';
  drawerCampaignsList = buildDrawerList(data.campaigns || [], 'Nome da campanha…');
  pWrap.appendChild(drawerCampaignsList);

  $('editDrawer').style.display = '';
}

function closeDrawer() {
  $('editDrawer').style.display = 'none';
  drawerProfile       = null;
  drawerCreativesList = null;
  drawerCampaignsList = null;
}

async function saveDrawer() {
  if (!drawerProfile) return;
  const profileId = drawerProfile.user_id;
  const creatives  = drawerCreativesList ? drawerCreativesList.getItems() : [];
  const campaigns  = drawerCampaignsList ? drawerCampaignsList.getItems() : [];
  const status     = $('drawerStatus').value;
  const notes      = $('drawerNotes').value.trim();

  const btn = $('btnSaveDrawer');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    await saveCreative(profileId, creatives, notes, campaigns, status);
    state.creatives[profileId] = { creatives, campaigns, notes, status };
    showToast('Alterações salvas!', 'success');
    updateStats();
    renderTable();
    closeDrawer();
  } catch {
    showToast('Erro ao salvar', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar alterações';
  }
}

/* ── Read-only chip list ─────────────────────────────────────── */
function buildReadonlyChips(items, extraClass = '', maxShow = 3) {
  if (!items || items.length === 0) return null;
  const wrap = document.createElement('div');
  wrap.className = 'chips-readonly';
  items.slice(0, maxShow).forEach(item => {
    const chip = document.createElement('span');
    chip.className = `chip-readonly${extraClass ? ' ' + extraClass : ''}`;
    chip.textContent = item;
    chip.title = item;
    wrap.appendChild(chip);
  });
  if (items.length > maxShow) {
    const more = document.createElement('span');
    more.className = 'chip-readonly-more';
    more.textContent = `+${items.length - maxShow} mais`;
    wrap.appendChild(more);
  }
  return wrap;
}

/* ── Client-side filtering ───────────────────────────────────── */
function getFiltered() {
  const { search, tagId, creativesFilter: cf, status } = state.filters;
  const q = search.toLowerCase();
  return state.allProfiles.filter(p => {
    if (q) {
      const hay = `${p.name} ${p.user_id} ${p.remark || ''} ${p.username || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tagId) {
      const ids = getProfileTagObjects(p).map(t => t.id);
      if (!ids.includes(tagId)) return false;
    }
    if (cf === 'with')    { if (!state.creatives[p.user_id]?.creatives?.length) return false; }
    if (cf === 'without') { if (state.creatives[p.user_id]?.creatives?.length > 0) return false; }
    if (status) {
      const pStatus = state.creatives[p.user_id]?.status || '';
      if (pStatus !== status) return false;
    }
    return true;
  });
}

/* ── Render table ────────────────────────────────────────────── */
function renderTable() {
  const allFiltered = getFiltered();
  const totalPages  = Math.max(1, Math.ceil(allFiltered.length / state.displayPageSize));
  if (state.displayPage > totalPages) state.displayPage = 1;
  const start    = (state.displayPage - 1) * state.displayPageSize;
  const filtered = allFiltered.slice(start, start + state.displayPageSize);

  if (filtered.length === 0) {
    tableWrap.style.display  = 'none';
    pagination.style.display = 'none';
    emptyState.style.display = '';
    $('emptyMessage').textContent = state.allProfiles.length === 0
      ? 'Configure a API do AdsPower nas configurações para começar.'
      : 'Nenhum perfil encontrado com os filtros aplicados.';
    $('btnEmptySettings').style.display = state.allProfiles.length === 0 ? '' : 'none';
    return;
  }

  tableWrap.style.display  = '';
  emptyState.style.display = 'none';
  profilesBody.innerHTML   = '';

  filtered.forEach(profile => {
    const tags   = getProfileTagObjects(profile);
    const data   = state.creatives[profile.user_id] || { creatives: [], campaigns: [], notes: '', status: '' };
    const access = formatTime(profile.last_open_time);

    const tr = document.createElement('tr');

    // #
    const tdNum = document.createElement('td');
    tdNum.innerHTML = `<span class="serial-num">${escHtml(String(profile.serial_number || ''))}</span>`;
    tr.appendChild(tdNum);

    // Perfil
    const tdProfile = document.createElement('td');
    tdProfile.innerHTML = `
      <span class="profile-name">${escHtml(profile.name || '—')}</span>
      <span class="profile-id">${escHtml(profile.user_id || '')}</span>
    `;
    tr.appendChild(tdProfile);

    // Grupo
    const tdGroup = document.createElement('td');
    tdGroup.innerHTML = profile.group_name
      ? `<span class="group-badge" title="${escHtml(profile.group_name)}">${escHtml(profile.group_name)}</span>`
      : '<span class="cell-empty">—</span>';
    tr.appendChild(tdGroup);

    // Tags
    const tdTags = document.createElement('td');
    if (tags.length > 0) {
      tdTags.innerHTML = `<div class="tags-wrap">${tags.map(t =>
        `<span class="tag-chip tag-${escHtml(t.color || 'blue')}" title="${escHtml(t.name)}">${escHtml(t.name)}</span>`
      ).join('')}</div>`;
    } else {
      tdTags.innerHTML = '<span class="cell-empty">—</span>';
    }
    tr.appendChild(tdTags);

    // Status
    const tdStatus = document.createElement('td');
    tdStatus.innerHTML = statusBadgeHtml(data.status || '');
    tr.appendChild(tdStatus);

    // Criativos (read-only)
    const tdCreatives = document.createElement('td');
    const cChips = buildReadonlyChips(data.creatives, '', 3);
    if (cChips) {
      tdCreatives.appendChild(cChips);
    } else {
      tdCreatives.innerHTML = '<span class="cell-empty">—</span>';
    }
    tr.appendChild(tdCreatives);

    // Campanhas (read-only)
    const tdCampaigns = document.createElement('td');
    const pChips = buildReadonlyChips(data.campaigns || [], 'chip-campaign-readonly', 2);
    if (pChips) {
      tdCampaigns.appendChild(pChips);
    } else {
      tdCampaigns.innerHTML = '<span class="cell-empty">—</span>';
    }
    tr.appendChild(tdCampaigns);

    // Dias Ativo (extraído das campanhas)
    const tdDays = document.createElement('td');
    const daysCell = buildDaysActiveCell(data.campaigns || []);
    if (daysCell) {
      tdDays.appendChild(daysCell);
    } else {
      tdDays.innerHTML = '<span class="cell-empty">—</span>';
    }
    tr.appendChild(tdDays);

    // Último Acesso
    const tdAccess = document.createElement('td');
    tdAccess.innerHTML = `<span class="access-time ${access.cls}">${access.text}</span>`;
    tr.appendChild(tdAccess);

    // Editar
    const tdEdit = document.createElement('td');
    tdEdit.className = 'col-edit';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-row';
    editBtn.title = 'Editar perfil';
    editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', () => openDrawer(profile));
    tdEdit.appendChild(editBtn);
    tr.appendChild(tdEdit);

    profilesBody.appendChild(tr);
  });

  // Pagination
  if (totalPages > 1) {
    pagination.style.display = '';
    $('pageInfo').textContent = `Página ${state.displayPage} de ${totalPages} — ${allFiltered.length} perfis`;
    $('btnPrevPage').disabled = state.displayPage <= 1;
    $('btnNextPage').disabled = state.displayPage >= totalPages;
  } else {
    pagination.style.display = 'none';
  }
}

/* ── Load all data ───────────────────────────────────────────── */
async function loadAll() {
  if (state.loading) return;
  state.loading = true;
  tableWrap.style.display    = 'none';
  emptyState.style.display   = 'none';
  pagination.style.display   = 'none';
  loadingState.style.display = '';

  try {
    await Promise.all([loadGroups(), loadCreatives()]);
    await loadProfiles();
    setConnected(true);
    updateStats();
    renderTable();
  } catch (err) {
    setConnected(false);
    emptyState.style.display = '';
    $('emptyMessage').textContent = `Erro ao conectar: ${err.message}`;
    $('btnEmptySettings').style.display = '';
    showToast(`Erro: ${err.message}`, 'error', 4000);
  } finally {
    state.loading = false;
    loadingState.style.display = 'none';
  }
}

/* ── Settings modal ──────────────────────────────────────────── */
async function openSettings() {
  const cfg = await api('/api/config').catch(() => ({ apiKey: '', port: 50325 }));
  $('cfgPort').value   = cfg.port   || 50325;
  $('cfgApiKey').value = cfg.apiKey || '';
  settingsModal.style.display = '';
}

function closeSettings() { settingsModal.style.display = 'none'; }

async function saveSettings() {
  const port   = Number($('cfgPort').value) || 50325;
  const apiKey = $('cfgApiKey').value.trim();
  await api('/api/config', { method: 'POST', body: JSON.stringify({ port, apiKey }) });
  closeSettings();
  showToast('Configurações salvas!', 'success');
  state.displayPage = 1;
  await loadAll();
}

/* ── Filter handlers ─────────────────────────────────────────── */
function applyFilters() { state.displayPage = 1; renderTable(); }

searchInput.addEventListener('input', () => {
  state.filters.search = searchInput.value;
  applyFilters();
});
groupFilter.addEventListener('change', () => {
  state.filters.groupId = groupFilter.value;
  state.displayPage = 1;
  loadAll();
});
tagFilter.addEventListener('change', () => {
  state.filters.tagId = tagFilter.value;
  applyFilters();
});
creativesFilter.addEventListener('change', () => {
  state.filters.creativesFilter = creativesFilter.value;
  applyFilters();
});
statusFilter.addEventListener('change', () => {
  state.filters.status = statusFilter.value;
  applyFilters();
});

/* ── Button handlers ─────────────────────────────────────────── */
$('btnRefresh').addEventListener('click', () => { state.displayPage = 1; loadAll(); });
$('btnSettings').addEventListener('click', openSettings);
$('btnCloseSettings').addEventListener('click', closeSettings);
$('btnCancelSettings').addEventListener('click', closeSettings);
$('btnSaveSettings').addEventListener('click', saveSettings);
$('btnEmptySettings').addEventListener('click', openSettings);

$('btnPrevPage').addEventListener('click', () => {
  if (state.displayPage > 1) { state.displayPage--; renderTable(); }
});
$('btnNextPage').addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(getFiltered().length / state.displayPageSize));
  if (state.displayPage < totalPages) { state.displayPage++; renderTable(); }
});

$('btnCloseDrawer').addEventListener('click', closeDrawer);
$('btnCancelDrawer').addEventListener('click', closeDrawer);
$('btnSaveDrawer').addEventListener('click', saveDrawer);
$('editDrawer').addEventListener('click', e => {
  if (e.target === $('editDrawer')) closeDrawer();
});

settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) closeSettings();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDrawer(); closeSettings(); }
});

/* ── Boot ────────────────────────────────────────────────────── */
(async () => {
  const cfg = await api('/api/config').catch(() => null);
  if (cfg && cfg.port) {
    loadAll();
  } else {
    loadingState.style.display = 'none';
    emptyState.style.display   = '';
  }
})();
