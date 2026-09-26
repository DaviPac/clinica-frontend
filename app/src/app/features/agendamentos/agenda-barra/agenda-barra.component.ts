import { Component, input, output } from '@angular/core';

export type ModoVisualizacao = 'mensal' | 'semanal';

/**
 * Barra de controles da agenda: modo de visualização, navegação de
 * período e o botão que abre os filtros no mobile.
 */
@Component({
  selector: 'app-agenda-barra',
  standalone: true,
  templateUrl: './agenda-barra.component.html',
  styleUrl: './agenda-barra.component.css',
})
export class AgendaBarraComponent {
  readonly modo = input.required<ModoVisualizacao>();
  readonly filtrosAbertos = input(false);

  readonly modoChange = output<ModoVisualizacao>();
  /** -1 para o período anterior, +1 para o próximo. */
  readonly navegar = output<1 | -1>();
  readonly hoje = output<void>();
  readonly alternarFiltros = output<void>();
}
