const DEFAULT_BASE = 'http://localhost:3000';

export function getBaseUrl(): string {
  return localStorage.getItem('wave_adspower_url') || DEFAULT_BASE;
}

export function saveBaseUrl(url: string) {
  localStorage.setItem('wave_adspower_url', url);
}

async function adsReq(base: string, path: string, opts: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const body = await res.json(); if (body?.msg) msg = body.msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export interface AdsConfig {
  apiKey: string;
  port: number;
}

export interface AdsProfile {
  user_id: string;
  name: string;
  serial_number: number;
  group_name: string;
  group_id: string;
  remark?: string;
  username?: string;
  last_open_time?: string | number;
  fbcc_user_tag?: Array<{ id: string | number; name: string; color?: string } | string>;
}

export interface AdsGroup {
  group_id: string;
  group_name: string;
}

export interface ProfileData {
  creatives: string[];
  campaigns: string[];
  notes: string;
  status: string;
  updatedAt?: string;
}

export const adsPowerApi = {
  getConfig: (base: string) =>
    adsReq(base, '/api/config'),

  saveConfig: (base: string, data: AdsConfig) =>
    adsReq(base, '/api/config', { method: 'POST', body: JSON.stringify(data) }),

  getGroups: (base: string) =>
    adsReq(base, '/api/ads/groups'),

  getProfiles: (base: string, params: URLSearchParams) =>
    adsReq(base, `/api/ads/profiles?${params}`),

  getTags: (base: string) =>
    adsReq(base, '/api/ads/tags'),

  getProfileData: (base: string) =>
    adsReq(base, '/api/creatives') as Promise<Record<string, ProfileData>>,

  updateProfileData: (base: string, profileId: string, data: Omit<ProfileData, 'updatedAt'>) =>
    adsReq(base, `/api/creatives/${profileId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProfileData: (base: string, profileId: string) =>
    adsReq(base, `/api/creatives/${profileId}`, { method: 'DELETE' }),
};
