import { Component, input, output } from '@angular/core';

/**
 * Caixa de marcação com rótulo clicável.
 *
 *   <app-caixa-marcacao [marcada]="tudo()" (mudou)="tudo.set($event)">
 *     Aplicar a todas as sessões
 *   </app-caixa-marcacao>
 */
@Component({
  selector: 'app-caixa-marcacao',
  standalone: true,
  templateUrl: './caixa-marcacao.component.html',
  styleUrl: './caixa-marcacao.component.css',
})
export class CaixaMarcacaoComponent {
  readonly marcada = input(false);
  readonly mudou = output<boolean>();
}
