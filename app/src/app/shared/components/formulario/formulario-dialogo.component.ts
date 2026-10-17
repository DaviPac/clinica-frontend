import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DialogoComponent } from '../dialogo/dialogo.component';
import { FormularioComponent } from './formulario.component';
import { DefinicaoFormulario, ResultadoFormulario } from './formulario.model';

export interface DadosFormularioDialogo {
  titulo: string;
  definicao: DefinicaoFormulario<any, any>;
}

/** O `<app-formulario>` dentro de um `<app-dialogo>`. Quem abre é o `FormularioService`. */
@Component({
  selector: 'app-formulario-dialogo',
  standalone: true,
  imports: [DialogoComponent, FormularioComponent],
  template: `
    <app-dialogo [titulo]="dados.titulo">
      <app-formulario
        [definicao]="dados.definicao"
        (enviado)="ref.close($event)"
        (cancelado)="ref.close()"
        (processandoMudou)="ref.disableClose = $event" />
    </app-dialogo>
  `,
})
export class FormularioDialogoComponent {
  readonly dados = inject<DadosFormularioDialogo>(DIALOG_DATA);
  readonly ref = inject<DialogRef<ResultadoFormulario<unknown, unknown>>>(DialogRef);
}
