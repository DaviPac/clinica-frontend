export interface Paciente {
  id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  data_nascimento: string | null;
  criado_em: string;
}