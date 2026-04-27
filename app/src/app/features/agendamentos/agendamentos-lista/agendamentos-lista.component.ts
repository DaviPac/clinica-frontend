import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';

import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { ServicoService } from '../../../core/services/servico/servico.service';

import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AgendamentosModalComponent } from '../agendamentos-modal/agendamentos-modal.component';
import { AgendamentosStatusModalComponent } from '../agendamentos-status-modal/agendamentos-status-modal.component';
import { formatarDataHora, formatarHora } from '../../../core/utils/data.utils';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-agendamentos-lista',
  standalone: true,
  imports: [
    CommonModule, FormsModule, StatusBadgeComponent,
    AgendamentosModalComponent, AgendamentosStatusModalComponent,
    RouterLink,
  ],
  templateUrl: './agendamentos-lista.component.html',
  styleUrl: './agendamentos-lista.component.css'
})
export class AgendamentosListaComponent implements OnInit {
  private authService = inject(AuthService);
  private pacienteService = inject(PacienteService);
  private usuarioService = inject(UsuarioService);
  private servicoService = inject(ServicoService);
  private service = inject(AgendamentoService);
  
  router = inject(Router)

  agendamentos = signal<Agendamento[]>([]);
  carregando = signal(true);
  erro = signal<string | null>(null);

  isAdmin = this.authService.isAdmin;
  mostrarTodos = signal(this.isAdmin());

  mesAtual = signal<Date>(new Date());
  
  pacientesDict = signal<Record<number, string>>({});
  usuariosDict = signal<Record<number, string>>({});
  servicosDict = signal<Record<number, string>>({});

  modalCriacaoAberto = signal(false);
  agendamentoParaStatus = signal<Agendamento | null>(null);
  atualizandoPagamento = signal<number | null>(null);
  agendamentoParaCancelarSerie = signal<Agendamento | null>(null);
  cancelandoSerie = signal(false);

  // NOVO: modal de confirmação de pagamento de pacote
  agendamentoParaConfirmarPagamento = signal<Agendamento | null>(null);
  agendamentoParaCancelarPagamento = signal<Agendamento | null>(null);

  filtro = computed(() => {
    const data = this.mesAtual();
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    
    const formatar = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    };

    return { de: formatar(primeiroDia), ate: formatar(ultimoDia) };
  });

  labelPeriodo = computed(() => {
    const data = this.mesAtual();
    const mes = data.toLocaleDateString('pt-BR', { month: 'long' });
    const ano = data.getFullYear();
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} de ${ano}`;
  });

  diasCalendario = computed(() => {
    const data = this.mesAtual();
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias = [];
    const hoje = new Date();

    for (let i = 0; i < primeiroDia.getDay(); i++) {
      dias.push({ diaNumero: null as number | null, agendamentos: [] as Agendamento[], isToday: false });
    }

    const listaAgendamentos = this.agendamentos();

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const mesStr = String(mes + 1).padStart(2, '0');
      const diaStr = String(d).padStart(2, '0');
      const dataStr = `${ano}-${mesStr}-${diaStr}`;

      const agsDoDia = listaAgendamentos.filter(a => a.data_hora_inicio.startsWith(dataStr));
      const isToday = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
      dias.push({ diaNumero: d, agendamentos: agsDoDia, isToday });
    }

    return dias;
  });

  ngOnInit() { 
    this.carregarDadosBase(); 
  }

  carregarDadosBase() {
    this.carregando.set(true);
    forkJoin({
      pacientes: this.pacienteService.listar(true),
      usuarios: this.isAdmin() ? this.usuarioService.listar() : of([this.authService.usuario()]),
      servicos: this.servicoService.listar(true, true)
    }).subscribe({
      next: (res) => {
        const conv = (arr: any[]) => arr.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.nome }), {});
        this.pacientesDict.set(conv(res.pacientes));
        this.usuariosDict.set(conv(res.usuarios));
        this.servicosDict.set(conv(res.servicos));
        this.carregarAgendamentos();
      },
      error: (err) => {
        this.erro.set('Erro ao carregar dados auxiliares: ' + err.message);
        this.carregando.set(false);
      }
    });
  }

  carregarAgendamentos() {
    this.carregando.set(true);
    this.erro.set(null);
    const { de, ate } = this.filtro();
    
    this.service.listar(de, ate, this.mostrarTodos()).subscribe({
      next: lista => {
        this.agendamentos.set(
          lista.sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime())
        );
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  navegarMes(direcao: 1 | -1) {
    const atual = this.mesAtual();
    this.mesAtual.set(new Date(atual.getFullYear(), atual.getMonth() + direcao, 1));
    this.carregarAgendamentos();
  }

  // ALTERADO: intercepta se for pacote e o pagamento for para "pago"
  iniciarTogglePagamento(ag: Agendamento) {
    const vaiBaixar = !ag.pago_pelo_paciente; // true = vai marcar como pago

    if (ag.valor_pacote != null) {
      // Exibe modal de confirmação antes de prosseguir
      if (vaiBaixar) this.agendamentoParaConfirmarPagamento.set(ag);
      else this.agendamentoParaCancelarPagamento.set(ag)
    } else {
      this.executarTogglePagamento(ag);
    }
  }

  // NOVO: chamado ao confirmar no modal de pacote
  confirmarPagamentoPacote() {
    const ag = this.agendamentoParaConfirmarPagamento();
    if (!ag) return;
    this.agendamentoParaConfirmarPagamento.set(null);
    this.executarTogglePagamento(ag);
  }

  cancelarPagamentoPacote() {
    const ag = this.agendamentoParaCancelarPagamento();
    if (!ag) return;
    this.agendamentoParaCancelarPagamento.set(null);
    this.executarTogglePagamento(ag);
  }

  // ALTERADO: recarrega a lista completa após atualizar (cobre pacotes com múltiplas sessões)
  private executarTogglePagamento(ag: Agendamento) {
    this.atualizandoPagamento.set(ag.id);
    this.service.atualizarPagamento(ag.id, !ag.pago_pelo_paciente).subscribe({
      next: () => {
        this.atualizandoPagamento.set(null);
        this.carregarAgendamentos(); // recarrega tudo para refletir mudanças em cascata
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.atualizandoPagamento.set(null);
      },
    });
  }

  abrirModalStatus(ag: Agendamento) { 
    this.agendamentoParaStatus.set(ag); 
  }

  // ALTERADO: recarrega lista completa após mudança de status
  onStatusAtualizado(payload: { id: number; status: StatusAgendamento }) {
    this.agendamentoParaStatus.set(null);
    this.carregarAgendamentos();
  }

  // ALTERADO: recarrega lista após criação de agendamento
  onAgendamentoCriado() {
    this.modalCriacaoAberto.set(false);
    this.carregarAgendamentos();
  }

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
        this.carregarAgendamentos();
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.cancelandoSerie.set(false);
        this.agendamentoParaCancelarSerie.set(null);
      },
    });
  }

  formatarDataHora = formatarDataHora;
  formatarHora = formatarHora;

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  cardClass(status: StatusAgendamento): string {
    const map: Record<StatusAgendamento, string> = {
      AGENDADO:  'border-blue-200 bg-blue-50',
      REALIZADO: 'border-teal-200 bg-teal-50',
      FALTA:     'border-red-200 bg-red-50',
      CANCELADO: 'border-gray-200 bg-gray-100 opacity-60',
    };
    return map[status];
  }
}