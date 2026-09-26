import { Component, input } from '@angular/core';

/**
 * Indicador de carregamento: texto, com ou sem roda girando.
 *
 *   <app-carregando texto="Carregando pacientes..." [roda]="true" />
 */
@Component({
  selector: 'app-carregando',
  standalone: true,
  templateUrl: './carregando.component.html',
  styleUrl: './carregando.component.css',
  host: { '[attr.data-espaco]': 'espaco()' },
})
export class CarregandoComponent {
  texto = input('Carregando...');
  roda = input(false);
  espaco = input<'padrao' | 'apertado' | 'nenhum'>('padrao');
}
