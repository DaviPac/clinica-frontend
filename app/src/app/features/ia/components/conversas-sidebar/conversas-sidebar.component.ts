import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResumoConversa } from '../../../../core/ia/models/chat.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

interface Grupo {
  rotulo: string;
  conversas: ResumoConversa[];
}

@Component({
  selector: 'app-conversas-sidebar',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent],
  templateUrl: './conversas-sidebar.component.html',
})
export class ConversasSidebarComponent {
  readonly conversas = input.required<ResumoConversa[]>();
  readonly ativaId = input<string | null>(null);
  readonly somenteMemoria = input(false);

  readonly nova = output<void>();
  readonly selecionar = output<string>();
  readonly renomear = output<{ id: string; titulo: string }>();
  readonly remover = output<string>();

  readonly editandoId = signal<string | null>(null);
  readonly paraRemover = signal<ResumoConversa | null>(null);
  tituloEditado = '';

  readonly grupos = computed<Grupo[]>(() => {
    const hoje = inicioDoDia(new Date());
    const ontem = new Date(hoje.getTime() - 86_400_000);
    const semana = new Date(hoje.getTime() - 7 * 86_400_000);

    const baldes: Grupo[] = [
      { rotulo: 'Hoje', conversas: [] },
      { rotulo: 'Ontem', conversas: [] },
      { rotulo: 'Últimos 7 dias', conversas: [] },
      { rotulo: 'Anteriores', conversas: [] },
    ];

    for (const c of this.conversas()) {
      const data = new Date(c.atualizadoEm);
      if (data >= hoje) baldes[0].conversas.push(c);
      else if (data >= ontem) baldes[1].conversas.push(c);
      else if (data >= semana) baldes[2].conversas.push(c);
      else baldes[3].conversas.push(c);
    }

    return baldes.filter((g) => g.conversas.length > 0);
  });

  iniciarRenomeio(conversa: ResumoConversa, evento: Event): void {
    evento.stopPropagation();
    this.tituloEditado = conversa.titulo;
    this.editandoId.set(conversa.id);
  }

  confirmarRenomeio(id: string): void {
    if (this.editandoId() !== id) return;
    const titulo = this.tituloEditado.trim();
    this.editandoId.set(null);
    if (titulo) this.renomear.emit({ id, titulo });
  }

  pedirRemocao(conversa: ResumoConversa, evento: Event): void {
    evento.stopPropagation();
    this.paraRemover.set(conversa);
  }

  confirmarRemocao(id: string): void {
    this.paraRemover.set(null);
    this.remover.emit(id);
  }
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}
