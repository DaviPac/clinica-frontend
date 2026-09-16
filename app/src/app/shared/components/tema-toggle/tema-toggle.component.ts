import { Component, computed, inject, input } from '@angular/core';
import { TemaService } from '../../../core/services/tema/tema.service';

/**
 * Alterna entre o tema claro e o escuro.
 *
 * Use `mostrarRotulo` para exibir o texto ao lado do ícone — na sidebar
 * recolhida e na tela de login só cabe o ícone.
 */
@Component({
  selector: 'app-tema-toggle',
  standalone: true,
  templateUrl: './tema-toggle.component.html',
})
export class TemaToggleComponent {
  private readonly temaService = inject(TemaService);

  mostrarRotulo = input<boolean>(true);

  readonly escuro = computed(() => this.temaService.tema() === 'escuro');

  /** O rótulo anuncia o destino do clique, não o estado atual. */
  readonly rotulo = computed(() => (this.escuro() ? 'Tema claro' : 'Tema escuro'));

  alternar() {
    this.temaService.alternar();
  }
}
