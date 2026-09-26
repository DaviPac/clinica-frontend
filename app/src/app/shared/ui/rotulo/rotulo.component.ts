import { Component } from '@angular/core';

/**
 * Rótulo de campo de formulário.
 *
 *   <label appRotulo for="nome">Nome</label>
 */
@Component({
  selector: 'label[appRotulo]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './rotulo.component.css',
})
export class RotuloComponent {}
