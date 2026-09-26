import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CampoComponent } from '../campo/campo.component';
import { CampoFormComponent } from '../campo-form/campo-form.component';

/**
 * Campo de senha com o botão de mostrar/esconder.
 *
 * Recebe o FormControl direto porque o input mora dentro deste componente —
 * `formControlName` só enxerga o formulário do template onde é declarado.
 *
 *   <app-campo-senha rotulo="Senha atual" [controle]="form.controls.senhaAntiga" />
 */
@Component({
  selector: 'app-campo-senha',
  standalone: true,
  imports: [ReactiveFormsModule, CampoComponent, CampoFormComponent],
  templateUrl: './campo-senha.component.html',
  styleUrl: './campo-senha.component.css',
})
export class CampoSenhaComponent {
  rotulo = input('');
  controle = input.required<FormControl>();
  obrigatorio = input(false);
  erro = input<string | null>(null);
  placeholder = input('');

  readonly visivel = signal(false);

  alternar() {
    this.visivel.update((v) => !v);
  }
}
