import { Component, input, output } from '@angular/core';

/** Sessão que já passou e continua sem status definido. */
@Component({
  selector: 'app-linha-status',
  standalone: true,
  templateUrl: './linha-status.component.html',
  styleUrl: './linha-status.component.css',
})
export class LinhaStatusComponent {
  readonly paciente = input.required<string>();
  readonly quando = input.required<string>();

  readonly alterarStatus = output<void>();
}
