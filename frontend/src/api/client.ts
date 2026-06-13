import axios from 'axios';
import type { Creative, Options, Stats, Filters, Column } from '../types';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });

export const creativesApi = {
  list: (filters: Partial<Filters> = {}) =>
    api.get<Creative[]>('/creatives', { params: filters }).then(r => r.data),

  create: (data: Partial<Creative>) =>
    api.post<Creative>('/creatives', data).then(r => r.data),

  update: (id: number, data: Partial<Creative>) =>
    api.put<Creative>(`/creatives/${id}`, data).then(r => r.data),

  remove: (id: number) =>
    api.delete(`/creatives/${id}`),

  bulkDelete: (ids: number[]) =>
    api.post('/creatives/bulk-delete', { ids }),
};

export const optionsApi = {
  list: () => api.get<Options>('/options').then(r => r.data),
  create: (category: string, value: string, color: string) =>
    api.post('/options', { category, value, color }).then(r => r.data),
  remove: (category: string, value: string) =>
    api.delete(`/options/${category}/${encodeURIComponent(value)}`),
};

export const statsApi = {
  get: () => api.get<Stats>('/stats').then(r => r.data),
};

export const driveApi = {
  getConfig: () => api.get('/drive/config').then(r => r.data),
  updateConfig: (data: Record<string, unknown>) => api.put('/drive/config', data).then(r => r.data),
  getAuthUrl: () => api.get<{ url: string }>('/drive/auth-url').then(r => r.data.url),
  disconnect: () => api.post('/drive/disconnect').then(r => r.data),
  sync: () => api.post('/drive/sync').then(r => r.data),
};

export const youtubeApi = {
  getConfig: () => api.get('/youtube/config').then(r => r.data),
  updateConfig: (data: Record<string, unknown>) => api.put('/youtube/config', data).then(r => r.data),
  getAuthUrl: (accountId?: string) => api.get<{ url: string }>('/youtube/auth-url', { params: accountId ? { accountId } : {} }).then(r => r.data.url),
  removeAccount: (accountId: string) => api.delete(`/youtube/accounts/${accountId}`).then(r => r.data),
  refreshAccount: (accountId: string) => api.post(`/youtube/accounts/${accountId}/refresh`).then(r => r.data),
  upload: (payload: Record<string, unknown>) => api.post<{ jobId: string }>('/youtube/upload', payload).then(r => r.data),
  getJobStatus: (jobId: string) => api.get('/youtube/upload-status/' + jobId).then(r => r.data),
};

export const columnsApi = {
  list: () => api.get<Column[]>('/columns').then(r => r.data),
  update: (cols: Column[]) => api.put<Column[]>('/columns', cols).then(r => r.data),
  add: (label: string, type: string) => api.post<Column>('/columns', { label, type }).then(r => r.data),
  remove: (key: string) => api.delete(`/columns/${key}`),
};
