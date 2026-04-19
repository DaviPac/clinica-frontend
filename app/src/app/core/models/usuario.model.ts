export type Role = 'ADMIN' | 'PROFISSIONAL';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: Role;
  profissao: string | null;
  taxa_comissao_padrao: number;
  criado_em: string;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}