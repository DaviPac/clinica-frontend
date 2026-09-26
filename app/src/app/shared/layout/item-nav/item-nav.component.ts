import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Item de navegação da barra lateral. Existe como componente porque o
 * shell repete o mesmo link em dois grupos (atendimento e administração)
 * — e para que o CSS do link more junto do seu HTML.
 */
@Component({
  selector: 'app-item-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './item-nav.component.html',
  styleUrl: './item-nav.component.css',
  host: { '[attr.data-admin]': "admin() ? '' : null" },
})
export class ItemNavComponent {
  readonly rota = input.required<string>();
  readonly rotulo = input.required<string>();
  /** Dados do `d` do `<path>` do ícone. */
  readonly icone = input.required<string>();
  /** Com a gaveta recolhida só o ícone aparece. */
  readonly mostrarTexto = input(true);
  readonly admin = input(false);

  readonly navegar = output<void>();
}
