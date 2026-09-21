import { Component, computed, input } from '@angular/core';

/**
 * Círculo com as iniciais de uma pessoa.
 *
 *   <app-avatar [nome]="usuario.nome" tamanho="g" />
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: '{{ iniciais() }}',
  styleUrl: './avatar.component.css',
  host: { '[attr.data-tamanho]': 'tamanho()', 'aria-hidden': 'true' },
})
export class AvatarComponent {
  nome = input('');
  tamanho = input<'p' | 'm' | 'g' | 'gg'>('m');

  readonly iniciais = computed(() =>
    this.nome()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase(),
  );
}
