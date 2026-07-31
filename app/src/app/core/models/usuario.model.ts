export type Role = 'ADMIN' | 'PROFISSIONAL';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: Role;
  profissao: string | null;
  taxaComissaoPadrao: number;
  criadoEm: string;
  profissionalRecebe: boolean;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface MudarSenhaRequest {
  senhaAntiga: string;
  novaSenha: string;
}