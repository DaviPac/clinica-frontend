export interface Paciente {
  id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  data_nascimento: string | null;
  ativo: boolean;
  criado_em: string;
}