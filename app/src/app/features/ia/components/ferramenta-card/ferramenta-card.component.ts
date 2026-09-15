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
  templateUrl: './ferramenta-card.component.html',
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
