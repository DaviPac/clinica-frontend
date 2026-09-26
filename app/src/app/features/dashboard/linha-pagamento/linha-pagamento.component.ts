import { Component, input, output } from '@angular/core';

/** Sessão realizada que ainda aguarda pagamento. */
@Component({
  selector: 'app-linha-pagamento',
  standalone: true,
  templateUrl: './linha-pagamento.component.html',
  styleUrl: './linha-pagamento.component.css',
})
export class LinhaPagamentoComponent {
  readonly paciente = input.required<string>();
  readonly quando = input.required<string>();
  /** Valor da sessão avulsa. */
  readonly valor = input('');
  /** Quando preenchido, a sessão faz parte de um pacote e mostra o total. */
  readonly valorPacote = input<string | null>(null);
  /** Só o admin registra o pagamento daqui. */
  readonly podeMarcar = input(false);
  readonly atualizando = input(false);

  readonly marcarPago = output<void>();
}
