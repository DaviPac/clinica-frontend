import { Component, input, output } from '@angular/core';
import { StatusAgendamento } from '../../../core/models/agendamento.model';

/**
 * Pilha de ações da ficha de um agendamento. Só apresentação: quem decide
 * o que cada ação faz é a tela.
 */
@Component({
  selector: 'app-detalhe-acoes',
  standalone: true,
  templateUrl: './detalhe-acoes.component.html',
  styleUrl: './detalhe-acoes.component.css',
})
export class DetalheAcoesComponent {
  readonly status = input.required<StatusAgendamento>();
  readonly pago = input(false);
  /** O profissional só alterna o pagamento das sessões que ele recebe. */
  readonly podeAlternarPagamento = input(false);
  readonly temSerie = input(false);
  readonly atualizandoPagamento = input(false);

  readonly alterarStatus = output<void>();
  readonly reagendar = output<void>();
  readonly alternarPagamento = output<void>();
  readonly cancelarSerie = output<void>();
}
