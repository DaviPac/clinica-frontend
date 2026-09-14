import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ModelosService } from '../../../../core/ia/gemini/modelos.service';
import { NivelRaciocinio, ROTULO_RACIOCINIO } from '../../../../core/ia/ia.config';

const NIVEIS: NivelRaciocinio[] = ['desligado', 'equilibrado', 'profundo'];

@Component({
  selector: 'app-seletor-modelo',
  standalone: true,
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="aberto.set(!aberto())"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-stone-600
               hover:bg-stone-100 cursor-pointer bg-transparent border-none transition-colors">
        <span class="font-medium">{{ rotuloModelo() }}</span>
        @if (raciocinioAtivo()) {
          <span class="text-brand-600">· {{ rotuloNivelCurto() }}</span>
        }
        <svg class="w-3 h-3 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      @if (aberto()) {
        <div class="fixed inset-0 z-30" (click)="aberto.set(false)"></div>

        <div class="absolute right-0 top-full mt-1 z-40 w-72 bg-white border border-stone-200
                    rounded-xl shadow-lg overflow-hidden">
          <p class="px-3 pt-3 pb-1.5 text-[10px] font-medium text-stone-400 uppercase tracking-widest">
            Modelo
          </p>

          @for (m of modelos.modelos(); track m.id) {
            <button
              type="button"
              (click)="escolherModelo(m.id)"
              class="w-full text-left px-3 py-2 hover:bg-stone-50 cursor-pointer bg-transparent
                     border-none transition-colors flex items-start gap-2">
              <span
                class="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                [class]="m.id === modeloId() ? 'bg-brand-500' : 'bg-transparent'"></span>
              <span class="min-w-0">
                <span class="block text-sm text-stone-900">{{ m.rotulo }}</span>
                <span class="block text-[11px] text-stone-500 leading-snug">{{ m.descricao }}</span>
              </span>
            </button>
          }

          @if (suportaRaciocinio()) {
            <div class="border-t border-stone-100 mt-1">
              <p class="px-3 pt-3 pb-1.5 text-[10px] font-medium text-stone-400 uppercase tracking-widest">
                Raciocínio
              </p>
              @for (n of niveis; track n) {
                <button
                  type="button"
                  (click)="escolherNivel(n)"
                  class="w-full text-left px-3 py-2 hover:bg-stone-50 cursor-pointer bg-transparent
                         border-none transition-colors flex items-center gap-2">
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    [class]="n === nivel() ? 'bg-brand-500' : 'bg-transparent'"></span>
                  <span class="text-sm text-stone-700">{{ rotulos[n] }}</span>
                </button>
              }
              <p class="px-3 pb-3 pt-1 text-[11px] text-stone-400 leading-snug">
                Mais raciocínio melhora tarefas com várias etapas, mas consome mais tokens.
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SeletorModeloComponent {
  readonly modelos = inject(ModelosService);

  readonly modeloId = input.required<string>();
  readonly nivel = input.required<NivelRaciocinio>();

  readonly modeloMudou = output<string>();
  readonly nivelMudou = output<NivelRaciocinio>();

  readonly aberto = signal(false);
  readonly niveis = NIVEIS;
  readonly rotulos = ROTULO_RACIOCINIO;

  readonly rotuloModelo = computed(
    () => this.modelos.modelo(this.modeloId())?.rotulo ?? this.modeloId(),
  );
  readonly suportaRaciocinio = computed(
    () => this.modelos.modelo(this.modeloId())?.suportaRaciocinio ?? false,
  );
  readonly raciocinioAtivo = computed(
    () => this.suportaRaciocinio() && this.nivel() !== 'desligado',
  );
  readonly rotuloNivelCurto = computed(() =>
    this.nivel() === 'profundo' ? 'raciocínio profundo' : 'raciocínio',
  );

  escolherModelo(id: string): void {
    this.aberto.set(false);
    if (id !== this.modeloId()) this.modeloMudou.emit(id);
  }

  escolherNivel(nivel: NivelRaciocinio): void {
    this.aberto.set(false);
    if (nivel !== this.nivel()) this.nivelMudou.emit(nivel);
  }
}
