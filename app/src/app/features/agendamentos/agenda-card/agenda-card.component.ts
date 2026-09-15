import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Agendamento } from '../../../core/models/agendamento.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { formatarHora } from '../../../core/utils/data.utils';

/**
 * Card de uma sessão na agenda (usado nas visões mensal e semanal).
 *
 * Puramente apresentacional: não fala com serviços — quem muta o agendamento
 * é sempre o container (`AgendamentosListaComponent`), via os outputs.
 *
 * No desktop o card é um link com os botões de ação ao lado (irmãos, nunca
 * aninhados dentro do `<a>`). No mobile (`modoToque`) o card inteiro vira um
 * botão que abre a bottom sheet de ações.
 */
@Component({
  selector: 'app-agenda-card',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  templateUrl: './agenda-card.component.html',
  styleUrl: './agenda-card.component.css',
})
export class AgendaCardComponent {
  agendamento = input.required<Agendamento>();
  pacienteNome = input('');
  profissionalNome = input('');
  servicoNome = input('');
  isAdmin = input(false);
  /** `true` somente enquanto ESTE agendamento tem pagamento em atualização. */
  atualizandoPagamento = input(false);
  /** No mobile o card inteiro é um botão que abre a sheet de ações. */
  modoToque = input(false);

  /** Card tocado no mobile — abrir a sheet de ações. */
  acoes = output<void>();
  status = output<void>();
  pagamento = output<void>();
  cancelarSerie = output<void>();

  formatarHora = formatarHora;

  podeAlterarStatus = computed(() => this.agendamento().status !== 'CANCELADO');

  podeCancelarSerie = computed(() => {
    const ag = this.agendamento();
    return ag.status === 'AGENDADO' && !!ag.recorrenciaGroupId;
  });

  pagamentoBloqueado = computed(() => {
    const ag = this.agendamento();
    return (!this.isAdmin() && !ag.profissionalRecebe) || this.atualizandoPagamento();
  });
}
