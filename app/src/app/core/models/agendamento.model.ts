export type StatusAgendamento = 'AGENDADO' | 'REALIZADO' | 'FALTA' | 'CANCELADO';

export interface Agendamento {
  id: number;
  paciente_id: number;
  profissional_id: number;
  servico_id: number;
  data_hora_inicio: string;
  data_hora_fim: string;
  valor_combinado: number;
  percentual_comissao_momento: number;
  status: StatusAgendamento;
  pago_pelo_paciente: boolean;
  recorrencia_group_id: string | null;
  criado_em: string;
}