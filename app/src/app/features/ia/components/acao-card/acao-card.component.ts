import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AcaoChat } from '../../../../core/ia/models/ferramenta-ia.model';
import { FinanceiroService } from '../../../../core/services/financeiro/financeiro.service';

/**
 * Card de ação proposta pelo assistente.
 *
 * Navegar e baixar são coisas que o usuário faz, não a IA: aqui elas viram um
 * link e um botão. Até o clique, nada acontece.
 */
@Component({
  selector: 'app-acao-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (acao(); as a) {
      <div class="flex flex-col gap-1.5">
        @if (a.tipo === 'navegar') {
          <a
            [routerLink]="a.comandos"
            class="btn btn-outline w-fit gap-2 no-underline">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            {{ a.rotulo }}
          </a>
        } @else {
          <button
            type="button"
            class="btn btn-outline w-fit gap-2"
            [disabled]="baixando()"
            (click)="baixar(a)">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
            </svg>
            {{ baixando() ? 'Gerando PDF…' : a.rotulo }}
          </button>
        }

        @if (erro(); as e) {
          <p class="text-xs text-red-600">{{ e }}</p>
        }
      </div>
    }
  `,
})
export class AcaoCardComponent {
  private readonly financeiro = inject(FinanceiroService);

  readonly acao = input.required<AcaoChat>();

  readonly baixando = signal(false);
  readonly erro = signal<string | null>(null);

  baixar(acao: AcaoChat): void {
    if (acao.tipo !== 'download') return;

    this.baixando.set(true);
    this.erro.set(null);

    const { inicio, fim, profissionalId } = acao.params;
    this.financeiro.baixarRelatorioSessoesPdf(inicio, fim, profissionalId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-sessoes-${inicio}-a-${fim}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        this.baixando.set(false);
      },
      error: () => {
        // Respostas blob não seguem o formato de erro do interceptor.
        this.erro.set('Não foi possível gerar o PDF. Tente novamente.');
        this.baixando.set(false);
      },
    });
  }
}
