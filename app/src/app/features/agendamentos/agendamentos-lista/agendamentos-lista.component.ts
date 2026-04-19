import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AgendamentosModalComponent } from '../agendamentos-modal/agendamentos-modal.component';
import { AgendamentosStatusModalComponent } from '../agendamentos-status-modal/agendamentos-status-modal.component';
import {
  semanaAtual, formatarDataHora, formatarHora, formatarDataCurta
} from '../../../core/utils/data.utils';

@Component({
  selector: 'app-agendamentos-lista',
  standalone: true,
  imports: [
    CommonModule, FormsModule, StatusBadgeComponent,
    AgendamentosModalComponent, AgendamentosStatusModalComponent,
  ],
  templateUrl: './agendamentos-lista.component.html',
})
export class AgendamentosListaComponent implements OnInit {
  agendamentos = signal<Agendamento[]>([]);
  carregando = signal(true);
  erro = signal<string | null>(null);

  filtro = signal(semanaAtual());

  // Modais
  modalCriacaoAberto = signal(false);
  agendamentoParaStatus = signal<Agendamento | null>(null);

  // Pagamento inline — id do agendamento sendo atualizado
  atualizandoPagamento = signal<number | null>(null);

  // Cancelamento de recorrência
  agendamentoParaCancelarSerie = signal<Agendamento | null>(null);
  cancelandoSerie = signal(false);

  labelPeriodo = computed(() => {
    const { de, ate } = this.filtro();
    const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit',
    });
    return `${fmt(de)} a ${fmt(ate)}`;
  });

  constructor(private service: AgendamentoService) {}

  ngOnInit() { this.carregar(); }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    const { de, ate } = this.filtro();
    this.service.listar(de, ate).subscribe({
      next: lista => {
        // Ordena por data de início
        this.agendamentos.set(
          lista.sort((a, b) =>
            new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime()
          )
        );
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  navegarSemana(direcao: 1 | -1) {
    const { de, ate } = this.filtro();
    const mover = (s: string, dias: number) => {
      const d = new Date(s + 'T12:00:00');
      d.setDate(d.getDate() + dias);
      return d.toISOString().slice(0, 10);
    };
    this.filtro.set({ de: mover(de, direcao * 7), ate: mover(ate, direcao * 7) });
    this.carregar();
  }

  onFiltroChange() { this.carregar(); }

  // --- Pagamento ---
  togglePagamento(ag: Agendamento) {
    this.atualizandoPagamento.set(ag.id);
    this.service.atualizarPagamento(ag.id, !ag.pago_pelo_paciente).subscribe({
      next: ({ pago_pelo_paciente }) => {
        this.agendamentos.update(lista =>
          lista.map(a => a.id === ag.id ? { ...a, pago_pelo_paciente } : a)
        );
        this.atualizandoPagamento.set(null);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.atualizandoPagamento.set(null);
      },
    });
  }

  // --- Status ---
  abrirModalStatus(ag: Agendamento) {
    this.agendamentoParaStatus.set(ag);
  }

  onStatusAtualizado(payload: { id: number; status: StatusAgendamento }) {
    this.agendamentos.update(lista =>
      lista.map(a => a.id === payload.id ? { ...a, status: payload.status } : a)
    );
    this.agendamentoParaStatus.set(null);
  }

  // --- Cancelar série ---
  confirmarCancelamentoSerie(ag: Agendamento) {
    this.agendamentoParaCancelarSerie.set(ag);
  }

  cancelarSerie() {
    const ag = this.agendamentoParaCancelarSerie();
    if (!ag?.recorrencia_group_id) return;

    this.cancelandoSerie.set(true);
    this.service.cancelarRecorrencia(ag.recorrencia_group_id).subscribe({
      next: () => {
        this.agendamentoParaCancelarSerie.set(null);
        this.cancelandoSerie.set(false);
        this.carregar();
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.cancelandoSerie.set(false);
        this.agendamentoParaCancelarSerie.set(null);
      },
    });
  }

  // --- Helpers de template ---
  formatarDataHora = formatarDataHora;
  formatarHora = formatarHora;
  formatarDataCurta = formatarDataCurta;

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  cardClass(status: StatusAgendamento): string {
    const map: Record<StatusAgendamento, string> = {
      AGENDADO:  'border-gray-200 bg-white',
      REALIZADO: 'border-teal-100 bg-white',
      FALTA:     'border-red-100 bg-red-50',
      CANCELADO: 'border-gray-100 bg-gray-50 opacity-60',
    };
    return map[status];
  }
}