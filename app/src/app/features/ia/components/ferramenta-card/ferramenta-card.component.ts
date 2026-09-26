import { Component, computed, input, output, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MensagemFerramenta } from '../../../../core/ia/models/chat.model';
import { AcaoCardComponent } from '../acao-card/acao-card.component';
import { ConfAgendamentoCriarComponent } from '../confirmacoes/conf-agendamento-criar.component';
import { ConfGenericoComponent } from '../confirmacoes/conf-generico.component';
import { BotaoComponent } from '../../../../shared/ui/botao/botao.component';

/**
 * Card de uma chamada de ferramenta.
 *
 * Leitura vira uma linha discreta; escrita vira um card de confirmação com o
 * formulário editável. O estado final (confirmada, cancelada, erro) vira um chip.
 */
@Component({
  selector: 'app-ferramenta-card',
  standalone: true,
  imports: [JsonPipe, AcaoCardComponent, ConfGenericoComponent, ConfAgendamentoCriarComponent, BotaoComponent],
  templateUrl: './ferramenta-card.component.html',
  styleUrl: './ferramenta-card.component.css',
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

  readonly classeDesfecho = computed(() => {
    switch (this.mensagem().estado) {
      case 'confirmada':
        return 'desfecho--ok';
      case 'erro':
        return 'desfecho--erro';
      default:
        return 'desfecho--neutro';
    }
  });
}
