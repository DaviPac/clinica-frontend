import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Agendamento } from '../../../core/models/agendamento.model';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { formatarHora } from '../../../core/utils/data.utils';

/**
 * Bottom sheet de ações de uma sessão — o caminho de edição no mobile,
 * onde os botões minúsculos do card não são alvos de toque viáveis.
 *
 * Reaproveita o <app-modal>, que já é bottom sheet abaixo de `sm` e fecha
 * por backdrop, × ou Esc. As regras de exibição repetem exatamente as do
 * card no desktop.
 */
@Component({
  selector: 'app-agenda-acoes-sheet',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalComponent, StatusBadgeComponent],
  templateUrl: './agenda-acoes-sheet.component.html',
})
export class AgendaAcoesSheetComponent {
  agendamento = input.required<Agendamento>();
  pacienteNome = input('');
  profissionalNome = input('');
  servicoNome = input('');
  isAdmin = input(false);
  atualizandoPagamento = input(false);

  fechar = output<void>();
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
