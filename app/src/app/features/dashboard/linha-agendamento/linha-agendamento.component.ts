import { Component, input, output } from '@angular/core';
import { StatusAgendamento } from '../../../core/models/agendamento.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

/** Uma sessão na lista de próximos agendamentos do dashboard. */
@Component({
  selector: 'app-linha-agendamento',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './linha-agendamento.component.html',
  styleUrl: './linha-agendamento.component.css',
  host: { '[attr.data-hoje]': 'hoje() ? "sim" : null' },
})
export class LinhaAgendamentoComponent {
  readonly paciente = input.required<string>();
  readonly profissional = input('');
  readonly servico = input('');
  readonly status = input.required<StatusAgendamento>();
  readonly hoje = input(false);
  /** Ex.: "seg" — só aparece quando a sessão não é hoje. */
  readonly diaSemana = input('');
  /** Ex.: "12/06" — idem. */
  readonly dia = input('');
  readonly hora = input.required<string>();

  readonly alterarStatus = output<void>();
}
