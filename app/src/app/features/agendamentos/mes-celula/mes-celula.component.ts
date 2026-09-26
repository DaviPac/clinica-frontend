import { Component, TemplateRef, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { StatusAgendamento } from '../../../core/models/agendamento.model';
import { DiaCalendario } from '../agenda.tipos';

/**
 * Uma célula da grade mensal. No desktop lista os cards do dia; no mobile
 * vira um alvo de toque com o número, bolinhas de densidade e o "+N".
 *
 * O card é injetado pela tela através de `cardTpl`: são doze bindings, e
 * repeti-los aqui só para atravessar a fronteira do componente não paga.
 */
@Component({
  selector: 'app-mes-celula',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './mes-celula.component.html',
  styleUrl: './mes-celula.component.css',
  host: { '[class.celula--fora]': '!dia().diaNumero' },
})
export class MesCelulaComponent {
  readonly dia = input.required<DiaCalendario>();
  /** No mobile a célula é um botão que abre a sheet do dia. */
  readonly modoToque = input(false);
  readonly cardTpl = input.required<TemplateRef<unknown>>();

  readonly abrir = output<void>();

  /** Modificador da bolinha de densidade para cada status. */
  classePonto(status: StatusAgendamento): string {
    const mapa: Record<StatusAgendamento, string> = {
      AGENDADO: 'celula__ponto--agendado',
      REALIZADO: 'celula__ponto--realizado',
      FALTA: 'celula__ponto--falta',
      CANCELADO: 'celula__ponto--cancelado',
    };
    return mapa[status];
  }
}
