import { Component } from '@angular/core';

/**
 * Campo de formulário: input, select ou textarea.
 *
 * Componente de atributo — o controle continua sendo o elemento nativo, então
 * `formControlName`, `type`, `disabled` e validação seguem funcionando.
 *
 *   <input appCampo type="email" formControlName="email" />
 *   <select appCampo formControlName="servicoId">…</select>
 */
@Component({
  selector: 'input[appCampo], select[appCampo], textarea[appCampo]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './campo.component.css',
})
export class CampoComponent {}
