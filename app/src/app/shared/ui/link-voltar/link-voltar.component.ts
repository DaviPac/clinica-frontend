import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Link de retorno no topo das telas de detalhe.
 *
 *   <app-link-voltar rota="/pacientes" texto="Voltar para pacientes" />
 */
@Component({
  selector: 'app-link-voltar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './link-voltar.component.html',
  styleUrl: './link-voltar.component.css',
})
export class LinkVoltarComponent {
  rota = input.required<string>();
  texto = input('Voltar');
}
