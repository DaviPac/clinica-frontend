export interface Paciente {
  id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  dataNascimento: string | null;
  enderecoCompleto: string | null;
  rg: string | null;
  ativo: boolean;
  criadoEm: string;
}