export interface Creative {
  id: number;
  ordem: string;
  criativo: string;
  tipo: string;
  data: string;
  oferta: string;
  status: string;
  gestor: string;
  gestor_id: string | null;
  editor_id: string | null;
  copy_id: string | null;
  observacoes: string;
  num_vendas: number;
  cpa: number;
  coluna1: number | null;
  coluna2: number | null;
  link_drive: string;
  youtube_url: string;
  pasta_origem: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'select' | 'date' | 'user';
  visible: boolean;
  fixed: boolean;
  width: number;
  selectCategory: string | null;
}

export interface OptionItem {
  value: string;
  color: string;
}

export interface Options {
  status: OptionItem[];
  tipo: OptionItem[];
  oferta: OptionItem[];
  [key: string]: OptionItem[];
}

export interface Stats {
  total: number;
  emTeste: number;
  ativo: number;
  totalVendas: number;
  cpaMedia: number;
  novos: number;
}

export interface Filters {
  search: string;
  status: string;
  gestor: string;
  oferta: string;
  tipo: string;
}

export type UserRole = 'gestor' | 'editor' | 'copy' | 'adm';
export type UserStatus = 'pending' | 'approved';

export interface AppUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
  role: UserRole | null;
  status: UserStatus;
  createdAt?: string;
}
