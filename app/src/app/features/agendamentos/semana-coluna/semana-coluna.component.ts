import { Component, TemplateRef, input } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { DiaSemana } from '../agenda.tipos';

/**
 * Uma coluna da grade semanal: cabeçalho fixo com o dia e a lista de
 * sessões rolável. O card vem da tela por `cardTpl`, como na grade mensal.
 */
@Component({
  selector: 'app-semana-coluna',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet],
  templateUrl: './semana-coluna.component.html',
  styleUrl: './semana-coluna.component.css',
})
export class SemanaColunaComponent {
  readonly dia = input.required<DiaSemana>();
  readonly cardTpl = input.required<TemplateRef<unknown>>();
}
