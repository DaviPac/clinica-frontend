import { Agendamento, StatusAgendamento } from '../../core/models/agendamento.model';

/** Uma célula da grade mensal. Sem `diaNumero` é preenchimento do mês vizinho. */
export interface DiaCalendario {
  diaNumero: number | null;
  /** 'YYYY-MM-DD' — chave usada para abrir a sheet do dia. */
  dataISO: string | null;
  agendamentos: Agendamento[];
  isToday: boolean;
  /** Status das primeiras sessões, para as bolinhas do mobile. */
  dots: StatusAgendamento[];
  /** Quantas sessões ficaram além das bolinhas ("+N"). */
  extras: number;
}

/** Uma coluna da grade semanal. */
export interface DiaSemana {
  data: Date;
  diaNumero: number;
  nomeDia: string;
  agendamentos: Agendamento[];
  isToday: boolean;
}
