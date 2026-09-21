import { Component, input, output } from '@angular/core';

/** Tela de boas-vindas de uma conversa ainda vazia, com as sugestões. */
@Component({
  selector: 'app-inicio-conversa',
  standalone: true,
  templateUrl: './inicio-conversa.component.html',
  styleUrl: './inicio-conversa.component.css',
})
export class InicioConversaComponent {
  readonly nome = input.required<string>();
  readonly sugestoes = input<readonly string[]>([]);

  readonly escolher = output<string>();
}
