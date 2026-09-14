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
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="alternar()"
        aria-label="Uso da chave de IA"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400
               hover:text-stone-700 hover:bg-stone-100 cursor-pointer bg-transparent
               border-none transition-colors">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      </button>

      @if (aberto()) {
        <div class="fixed inset-0 z-30" (click)="aberto.set(false)"></div>

        <div class="absolute right-0 top-full mt-1 z-40 w-80 bg-white border border-stone-200
                    rounded-xl shadow-lg p-4 flex flex-col gap-3.5">
          <p class="text-[10px] font-medium text-stone-400 uppercase tracking-widest">
            Uso da chave
          </p>

          <div>
            <div class="flex items-baseline justify-between text-xs mb-1.5">
              <span class="text-stone-600">Contexto da conversa</span>
              <span class="text-stone-900 font-medium">
                {{ formatar(uso().ultimoPrompt) }}
                @if (limiteEntrada(); as limite) {
                  <span class="text-stone-400"> / {{ formatar(limite) }}</span>
                }
              </span>
            </div>
            @if (percentualContexto(); as pct) {
              <div class="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div class="h-full bg-brand-400 rounded-full transition-all"
                     [style.width.%]="pct"></div>
              </div>
            }
          </div>

          <div class="border-t border-stone-100 pt-3">
            <p class="text-xs text-stone-600 mb-1.5">Esta conversa</p>
            <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt class="text-stone-500">Envio</dt>
              <dd class="text-stone-900 text-right">{{ formatar(uso().prompt) }}</dd>
              <dt class="text-stone-500">Resposta</dt>
              <dd class="text-stone-900 text-right">{{ formatar(uso().resposta) }}</dd>
              @if (uso().raciocinio > 0) {
                <dt class="text-stone-500">Raciocínio</dt>
                <dd class="text-stone-900 text-right">{{ formatar(uso().raciocinio) }}</dd>
              }
              <dt class="text-stone-500">Requisições</dt>
              <dd class="text-stone-900 text-right">{{ uso().requisicoes }}</dd>
            </dl>
          </div>

          @if (hoje(); as d) {
            <div class="border-t border-stone-100 pt-3">
              <p class="text-xs text-stone-600 mb-1.5">Hoje, neste dispositivo</p>
              <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt class="text-stone-500">Requisições</dt>
                <dd class="text-stone-900 text-right">{{ d.requisicoes }}</dd>
                <dt class="text-stone-500">Tokens</dt>
                <dd class="text-stone-900 text-right">
                  {{ formatar(d.tokensPrompt + d.tokensResposta + d.tokensRaciocinio) }}
                </dd>
              </dl>
            </div>
          }

          @if (detalheCota(); as cota) {
            <div class="border-t border-stone-100 pt-3">
              <p class="text-xs font-medium text-red-700 mb-1">Limite atingido</p>
              <p class="text-[11px] text-red-600 leading-snug break-words max-h-32 overflow-y-auto">
                {{ cota }}
              </p>
            </div>
          }

          <p class="text-[11px] text-stone-400 leading-snug border-t border-stone-100 pt-3">
            O Google não expõe a cota restante de uma chave. Os números acima são
            os tokens informados pela própria API e contagens feitas neste dispositivo.
          </p>
        </div>
      }
    </div>
  `,
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
