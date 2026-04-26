export interface Servico {
  id: number;
  profissional_id: number;
  nome: string;
  valor_atual: number;
  ativo: boolean;
  is_pacote: boolean;
}