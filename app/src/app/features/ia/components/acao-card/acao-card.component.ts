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
  templateUrl: './acao-card.component.html',
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
