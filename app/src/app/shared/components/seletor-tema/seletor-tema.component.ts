import { Component, computed, inject } from '@angular/core';
import { PreferenciaTema, TemaService } from '../../../core/services/tema/tema.service';

interface OpcaoTema {
  valor: PreferenciaTema;
  rotulo: string;
  /** path do ícone SVG (24x24, traço) */
  icone: string;
}

/** Escolha entre tema claro, escuro ou o do sistema operacional. */
@Component({
  selector: 'app-seletor-tema',
  standalone: true,
  templateUrl: './seletor-tema.component.html',
})
export class SeletorTemaComponent {
  private readonly temaService = inject(TemaService);

  readonly preferencia = this.temaService.preferencia;

  /** Só interessa mostrar o tema resolvido quando a escolha é 'sistema'. */
  readonly descricao = computed(() => {
    if (this.preferencia() !== 'sistema') return null;
    return this.temaService.tema() === 'escuro'
      ? 'Seu sistema está no escuro.'
      : 'Seu sistema está no claro.';
  });

  readonly opcoes: OpcaoTema[] = [
    {
      valor: 'claro',
      rotulo: 'Claro',
      icone:
        'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    },
    { valor: 'escuro', rotulo: 'Escuro', icone: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' },
    {
      valor: 'sistema',
      rotulo: 'Sistema',
      icone: 'M3 5.5h18v10H3v-10zM8 20h8M12 15.5V20',
    },
  ];

  selecionar(valor: PreferenciaTema) {
    this.temaService.definir(valor);
  }
}
