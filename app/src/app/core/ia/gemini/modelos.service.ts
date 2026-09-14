import { Injectable, inject, signal } from '@angular/core';
import { MODELOS_IA, ModeloIA } from '../ia.config';
import { GeminiChatClient } from './gemini-chat.client';

export interface ModeloDisponivel extends ModeloIA {
  /** Janela de contexto real do modelo, segundo a API. */
  limiteEntrada?: number;
  limiteSaida?: number;
}

/**
 * Descobre quais modelos do catálogo a chave em uso realmente serve, e com que
 * limites de contexto.
 *
 * O que a API do Gemini expõe sobre uma chave é justamente isto: a lista de
 * modelos e os limites de token de cada um. Ela NÃO expõe cota restante — não há
 * endpoint de "requisições disponíveis hoje". Por isso o painel de uso combina
 * estes limites reais com contadores medidos localmente, em vez de exibir um
 * número de cota que seria inventado.
 */
@Injectable({ providedIn: 'root' })
export class ModelosService {
  private readonly cliente = inject(GeminiChatClient);

  readonly modelos = signal<ModeloDisponivel[]>([...MODELOS_IA]);
  readonly carregando = signal(false);
  private carregou = false;

  async carregar(): Promise<void> {
    if (this.carregou || this.carregando()) return;
    this.carregando.set(true);

    try {
      const ai = await this.cliente.cliente();
      const pagina = await ai.models.list();

      const limites = new Map<string, { entrada?: number; saida?: number }>();
      for await (const modelo of pagina) {
        const id = (modelo.name ?? '').replace(/^models\//, '');
        if (!id) continue;
        // Só interessam modelos que servem generateContent.
        const acoes = modelo.supportedActions;
        if (acoes?.length && !acoes.includes('generateContent')) continue;
        limites.set(id, { entrada: modelo.inputTokenLimit, saida: modelo.outputTokenLimit });
      }

      const disponiveis = MODELOS_IA.filter((m) => limites.has(m.id)).map((m) => ({
        ...m,
        limiteEntrada: limites.get(m.id)?.entrada,
        limiteSaida: limites.get(m.id)?.saida,
      }));

      // Se o cruzamento não achar nada, o catálogo estático é melhor que um seletor vazio.
      this.modelos.set(disponiveis.length ? disponiveis : [...MODELOS_IA]);
      this.carregou = true;
    } catch (err: unknown) {
      console.warn('[ia] não foi possível listar os modelos da chave:', err);
      this.modelos.set([...MODELOS_IA]);
    } finally {
      this.carregando.set(false);
    }
  }

  modelo(id: string): ModeloDisponivel | undefined {
    return this.modelos().find((m) => m.id === id);
  }
}
