import { Component, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModelosService } from '../../../../core/ia/gemini/modelos.service';
import { UsoConversa, UsoDiario } from '../../../../core/ia/models/chat.model';
import { ConversaStore } from '../../../../core/ia/persistencia/conversa-store';

/**
 * Painel de uso da chave do Gemini.
 *
 * Importante sobre o que este painel NÃO mostra: a API do Gemini não expõe cota
 * restante para quem detém a chave — não existe endpoint de "requisições
 * disponíveis hoje". Então aqui só entram números reais: os tokens que a própria
 * API informa em cada resposta (usageMetadata), o limite de contexto real do
 * modelo (vindo de models.list) e contadores medidos neste dispositivo. Quando o
 * Google devolve um 429, a mensagem de cota dele aparece literalmente.
 */
@Component({
  selector: 'app-painel-uso',
  standalone: true,
  templateUrl: './painel-uso.component.html',
})
export class PainelUsoComponent {
  private readonly store = inject(ConversaStore);
  private readonly modelos = inject(ModelosService);

  readonly uso = input.required<UsoConversa>();
  readonly modeloId = input.required<string>();
  readonly detalheCota = input<string | null>(null);

  readonly aberto = signal(false);
  readonly hoje = signal<UsoDiario | null>(null);

  readonly limiteEntrada = computed(() => this.modelos.modelo(this.modeloId())?.limiteEntrada);

  readonly percentualContexto = computed<number | null>(() => {
    const limite = this.limiteEntrada();
    if (!limite) return null;
    return Math.min(100, (this.uso().ultimoPrompt / limite) * 100);
  });

  async alternar(): Promise<void> {
    const abrindo = !this.aberto();
    this.aberto.set(abrindo);
    if (!abrindo) return;

    const dia = new Date().toISOString().slice(0, 10);
    this.hoje.set(await firstValueFrom(this.store.usoDoDia(dia)));
  }

  formatar(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return String(tokens);
  }
}
