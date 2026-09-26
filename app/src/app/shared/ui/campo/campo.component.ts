import { Component, input } from '@angular/core';

export type EstadoCampo = 'normal' | 'invalido' | 'aviso';

/**
 * Campo de formulário: input, select ou textarea.
 *
 * Componente de atributo — o controle continua sendo o elemento nativo, então
 * `formControlName`, `type`, `disabled` e validação seguem funcionando.
 *
 *   <input appCampo type="email" formControlName="email" />
 *   <input appCampo mono [estado]="invalido() ? 'invalido' : 'normal'" />
 */
@Component({
  selector: 'input[appCampo], select[appCampo], textarea[appCampo]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './campo.component.css',
  host: {
    '[attr.data-estado]': 'estado() === "normal" ? null : estado()',
    '[attr.data-fonte]': 'mono() ? "mono" : null',
  },
})
export class CampoComponent {
  /** Destaca a borda quando o valor não passa na validação. */
  estado = input<EstadoCampo>('normal');
  /** Fonte monoespaçada — para CPF, RG e valores. */
  mono = input(false);
}
