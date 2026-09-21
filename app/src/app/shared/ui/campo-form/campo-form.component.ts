import { Component, input } from '@angular/core';
import { RotuloComponent } from '../rotulo/rotulo.component';

/**
 * Campo de formulário completo: rótulo, o controle e a mensagem de erro.
 * O controle é projetado, então continua sendo um `<input appCampo>` nativo
 * ligado ao formulário reativo.
 *
 *   <app-campo-form rotulo="Nome" [obrigatorio]="true" [erro]="erroNome()">
 *     <input appCampo id="nome" formControlName="nome" />
 *   </app-campo-form>
 */
@Component({
  selector: 'app-campo-form',
  standalone: true,
  imports: [RotuloComponent],
  templateUrl: './campo-form.component.html',
  styleUrl: './campo-form.component.css',
})
export class CampoFormComponent {
  rotulo = input('');
  /** `for` do rótulo — o mesmo `id` do controle projetado. */
  para = input('');
  obrigatorio = input(false);
  erro = input<string | null>(null);
  /** Texto de apoio abaixo do controle, quando não há erro. */
  ajuda = input('');
}
