import { Component, computed, input, output, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MensagemFerramenta } from '../../../../core/ia/models/chat.model';
import { AcaoCardComponent } from '../acao-card/acao-card.component';
import { ConfAgendamentoCriarComponent } from '../confirmacoes/conf-agendamento-criar.component';
import { ConfGenericoComponent } from '../confirmacoes/conf-generico.component';

/**
 * Card de uma chamada de ferramenta.
 *
 * Leitura vira uma linha discreta; escrita vira um card de confirmação com o
 * formulário editável. O estado final (confirmada, cancelada, erro) vira um chip.
 */
@Component({
  selector: 'app-ferramenta-card',
  standalone: true,
  imports: [JsonPipe, AcaoCardComponent, ConfGenericoComponent, ConfAgendamentoCriarComponent],
  template: `
    @let m = mensagem();

    @if (m.estado === 'pendente') {
      <!-- Confirmação de escrita -->
      <div class="border border-brand-300 rounded-xl overflow-hidden bg-white shadow-sm">
        <div class="px-4 pt-3 pb-2.5 bg-brand-50 border-b border-brand-200">
          <div class="flex items-center gap-2 mb-1">
            <svg class="w-4 h-4 text-brand-700 shrink-0" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            <span class="text-[11px] font-medium text-brand-800 uppercase tracking-wide">
              Confirmação necessária
            </span>
          </div>
          <p class="text-sm text-stone-900 leading-snug">{{ m.descricao }}</p>
        </div>

        <div class="px-4 py-3.5">
          <p class="text-[11px] text-stone-400 uppercase tracking-wide mb-3">
            Revise e ajuste antes de confirmar
          </p>

          @if (m.formulario === 'agendamento-criar') {
            <app-conf-agendamento-criar
              [args]="m.args"
              (alterado)="argsEditados.set($event)"
              (valido)="formularioValido.set($event)" />
          } @else {
            <app-conf-generico
              [ferramenta]="m.nome"
              [args]="m.args"
              (alterado)="argsEditados.set($event)"
              (valido)="formularioValido.set($event)" />
          }
        </div>

        <div class="flex gap-2 px-4 pb-4">
          <button type="button" class="btn btn-outline flex-1" (click)="cancelar.emit()">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary flex-1"
            [disabled]="!formularioValido()"
            (click)="confirmar.emit(argsEditados())">
            Confirmar
          </button>
        </div>
      </div>
    } @else if (m.escopo === 'escrita' || m.estado === 'erro') {
      <!-- Desfecho de uma escrita -->
      <div
        class="flex items-start gap-2 px-3 py-2 rounded-lg border text-xs"
        [class]="classesDesfecho()">
        <span class="shrink-0 mt-px">{{ icone() }}</span>
        <div class="min-w-0">
          <p class="font-medium">{{ m.descricao }}</p>
          @if (m.erro) {
            <p class="mt-0.5 opacity-90">{{ m.erro }}</p>
          } @else if (m.resumoUi) {
            <p class="mt-0.5 opacity-80">{{ m.resumoUi }}</p>
          }
        </div>
      </div>
    } @else {
      <!-- Leitura ou ação: linha discreta -->
      <div class="text-xs text-stone-500">
        @if (m.estado === 'executando') {
          <span class="inline-flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></span>
            {{ m.descricao }}…
          </span>
        } @else {
          <details class="group">
            <summary class="inline-flex items-center gap-1.5 cursor-pointer list-none hover:text-stone-700">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <span>{{ m.descricao }}</span>
              @if (m.resumoUi) {
                <span class="text-stone-400">· {{ m.resumoUi }}</span>
              }
            </summary>
            @if (m.resultado !== undefined) {
              <pre class="mt-2 p-2.5 bg-stone-50 border border-stone-200 rounded-lg overflow-x-auto
                          text-[11px] leading-relaxed text-stone-600 max-h-64">{{ m.resultado | json }}</pre>
            }
          </details>
        }
      </div>
    }

    @if (m.acao; as acao) {
      <div class="mt-2">
        <app-acao-card [acao]="acao" />
      </div>
    }
  `,
})
export class FerramentaCardComponent {
  readonly mensagem = input.required<MensagemFerramenta>();

  readonly confirmar = output<Record<string, unknown>>();
  readonly cancelar = output<void>();

  readonly argsEditados = signal<Record<string, unknown>>({});
  readonly formularioValido = signal(false);

  readonly icone = computed(() => {
    switch (this.mensagem().estado) {
      case 'confirmada':
        return '✓';
      case 'cancelada':
        return '○';
      case 'erro':
        return '×';
      default:
        return '·';
    }
  });

  readonly classesDesfecho = computed(() => {
    switch (this.mensagem().estado) {
      case 'confirmada':
        return 'bg-teal-50 border-teal-200 text-teal-800';
      case 'erro':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-stone-50 border-stone-200 text-stone-600';
    }
  });
}
