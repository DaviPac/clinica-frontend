import { Component } from '@angular/core';

/**
 * Contêiner de página: dá o respiro das bordas, mais largo no desktop.
 *
 *   <div appPagina>…</div>
 */
@Component({
  selector: '[appPagina]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './pagina.component.css',
})
export class PaginaComponent {}
