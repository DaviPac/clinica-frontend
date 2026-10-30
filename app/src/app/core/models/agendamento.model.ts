export type StatusAgendamento = 'AGENDADO' | 'REALIZADO' | 'FALTA' | 'CANCELADO';

export interface Agendamento {
  id: number;
  pacienteId: number;
  paciente: string;
  profissionalId: number;
  profissional: string;
  servicoId: number;
  servico: string;
  dataHoraInicio: string;
  dataHoraFim: string;
  valorCombinado: number;
  valorPacote: number | null;
  percentualComissaoMomento: number;
  status: StatusAgendamento;
  pagoPeloPaciente: boolean;
  recorrenciaGroupId: string | null;
  criadoEm: string;
  profissionalRecebe: boolean;
  possuiProntuario: boolean;
}
