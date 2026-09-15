import { AbstractControl } from '@angular/forms';
import { StatusAgendamento } from '../../core/models/agendamento.model';
import { Servico } from '../../core/models/servico.model';

/**
 * Regras de negócio do agendamento, compartilhadas entre o modal de
 * agendamentos e o formulário de confirmação do assistente de IA.
 *
 * Ficam fora dos componentes para as duas telas não divergirem: um pacote que
 * deixasse de forçar recorrência numa delas geraria cobrança errada.
 */

export interface ControlesAgendamento {
  recorrente: AbstractControl;
  pacote: AbstractControl;
  valor_combinado: AbstractControl;
}

/**
 * Aplica ao formulário as regras do serviço selecionado.
 *
 * Pacote fechado: a série é obrigatória (o controle de recorrência fica travado)
 * e `valor_combinado` recebe o valor TOTAL do pacote — o backend espera o total,
 * não o valor por sessão.
 */
export function aplicarRegrasDoServico(
  ctrls: ControlesAgendamento,
  servico: Servico | null,
): void {
  if (!servico) return;

  if (servico.is_pacote) {
    ctrls.recorrente.setValue(true);
    ctrls.pacote.setValue(true);
    ctrls.recorrente.disable();
    ctrls.valor_combinado.setValue(servico.valor_atual);
    return;
  }

  ctrls.recorrente.enable();
  ctrls.recorrente.setValue(false);
  ctrls.pacote.setValue(false);
  ctrls.valor_combinado.setValue(servico.valor_atual);
}

/** Valor por sessão de um pacote — exibição apenas, nunca enviado ao backend. */
export function valorPorSessao(valorTotal: number, totalSessoes: number): number | null {
  if (!Number.isFinite(valorTotal) || totalSessoes <= 0) return null;
  return valorTotal / totalSessoes;
}

/**
 * Transições de status permitidas. CANCELADO é terminal.
 *
 * Mora aqui para a tela de status e o assistente de IA oferecerem exatamente as
 * mesmas opções — antes cada um tinha a sua ideia do que era possível.
 */
export const TRANSICOES_STATUS: Record<StatusAgendamento, StatusAgendamento[]> = {
  AGENDADO: ['REALIZADO', 'FALTA', 'CANCELADO'],
  REALIZADO: ['AGENDADO'],
  FALTA: ['AGENDADO', 'CANCELADO'],
  CANCELADO: [],
};

export function transicoesPermitidas(atual: StatusAgendamento): StatusAgendamento[] {
  return TRANSICOES_STATUS[atual] ?? [];
}

export function transicaoValida(
  atual: StatusAgendamento,
  destino: StatusAgendamento,
): boolean {
  return transicoesPermitidas(atual).includes(destino);
}

/** Número mínimo de sessões numa série recorrente (a tela declara min="2"). */
export const MIN_SESSOES_RECORRENCIA = 2;
