import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { AgendamentoService } from '../../core/services/agendamento/agendamento.service';
import { FinanceiroService } from '../../core/services/financeiro/financeiro.service';
import { PacienteService } from '../../core/services/paciente/paciente.service';
import { ServicoService } from '../../core/services/servico/servico.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { UsuarioService } from '../../core/services/usuario/usuario.service';

import { Agendamento, StatusAgendamento } from '../../core/models/agendamento.model';
import { SaldoAReceber } from '../../core/models/financeiro.model'; // Mantido o caminho original

import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AgendamentosStatusModalComponent } from '../agendamentos/agendamentos-status-modal/agendamentos-status-modal.component';
import { formatarHora } from '../../core/utils/data.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent, AgendamentosStatusModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private agendamentoService = inject(AgendamentoService);
  private financeiroService = inject(FinanceiroService);
  private pacienteService = inject(PacienteService);
  private servicoService = inject(ServicoService);
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService)

  isAdmin = this.authService.isAdmin;

  carregando = signal(true);
  erro = signal<string | null>(null);

  // Dados
  proximosAgendamentos = signal<Agendamento[]>([]);
  agendamentosPendentes = signal<Agendamento[]>([]);
  pagamentosPendentes = signal<Agendamento[]>([]);
  saldoAReceber = signal<SaldoAReceber | null>(null); // Atualizado para a nova interface

  pacientesDict = signal<Record<number, string>>({});
  servicosDict = signal<Record<number, string>>({});
  usuariosDict = signal<Record<number, string>>({});

  // Modal de status
  agendamentoParaStatus = signal<Agendamento | null>(null);

  // Controle de pagamento inline
  atualizandoPagamento = signal<number | null>(null);
  agendamentoParaConfirmarPagamento = signal<Agendamento | null>(null);

  // Métricas
  totalProximos = computed(() => this.proximosAgendamentos().length);
  totalPendentes = computed(() => this.agendamentosPendentes().length);
  totalPagamentos = computed(() => this.pagamentosPendentes().length);
  totalSaldo = computed(() => this.saldoAReceber()?.saldo_a_receber ?? 0); // Atualizado

  periodoAtual = computed(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  saudacao = computed(() => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  });

  formatarHora = formatarHora;

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const dataHoje = `${ano}-${mes}-${dia}`;
    const dataDaquiA8 = new Date(hoje);
    dataDaquiA8.setDate(hoje.getDate() + 7);
    const anoFim = dataDaquiA8.getFullYear();
    const mesFim = String(dataDaquiA8.getMonth() + 1).padStart(2, '0');
    const diaFim = String(dataDaquiA8.getDate()).padStart(2, '0');
    const dataFimBusca = `${anoFim}-${mesFim}-${diaFim}`;

    forkJoin({
      proximos: this.agendamentoService.listar({ periodo: { de: dataHoje, ate: dataFimBusca }}),
      pendentes: this.agendamentoService.listarPendentes(true),
      pagamentos: this.agendamentoService.listarPagamentoPendente(true),
      saldo: this.financeiroService.getSaldoAReceber(this.mesAtual()), // Atualizado o método
      pacientes: this.pacienteService.listar(true),
      servicos: this.servicoService.listar({ incluirInativos: true }),
      usuarios: this.isAdmin() ? this.usuarioService.listar() : of([this.authService.usuario()!])
    }).subscribe({
      next: (res) => {
        const conv = (arr: any[]) =>
          arr.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.nome }), {});

        this.pacientesDict.set(conv(res.pacientes));
        this.servicosDict.set(conv(res.servicos));
        this.usuariosDict.set(conv(res.usuarios));

        const agora = new Date();
        const proximos = res.proximos
          .filter(a => a.status === 'AGENDADO' && new Date(a.data_hora_inicio) >= agora)
          .slice(0, 8);
        this.proximosAgendamentos.set(proximos);
        this.agendamentosPendentes.set(res.pendentes);
        this.pagamentosPendentes.set(res.pagamentos);
        this.saldoAReceber.set(res.saldo);
        
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao carregar dashboard: ' + err.message);
        this.carregando.set(false);
      },
    });
  }

  // ── Status modal ──

  abrirModalStatus(ag: Agendamento) {
    this.agendamentoParaStatus.set(ag);
  }

  onStatusAtualizado(_payload: { id: number; status: StatusAgendamento }) {
    this.agendamentoParaStatus.set(null);
    this.carregar();
  }

  // ── Pagamento inline ──

  iniciarTogglePagamento(ag: Agendamento) {
    // Proteção extra caso o HTML seja burlado
    if (!this.isAdmin()) return; 

    if (!ag.pago_pelo_paciente && ag.valor_pacote != null) {
      this.agendamentoParaConfirmarPagamento.set(ag);
    } else {
      this.executarTogglePagamento(ag);
    }
  }

  confirmarPagamentoPacote() {
    if (!this.isAdmin()) return;

    const ag = this.agendamentoParaConfirmarPagamento();
    if (!ag) return;
    this.agendamentoParaConfirmarPagamento.set(null);
    this.executarTogglePagamento(ag);
  }

  private executarTogglePagamento(ag: Agendamento) {
    this.atualizandoPagamento.set(ag.id);
    this.agendamentoService.atualizarPagamento(ag.id, !ag.pago_pelo_paciente).subscribe({
      next: () => {
        this.atualizandoPagamento.set(null);
        this.carregar();
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.atualizandoPagamento.set(null);
      },
    });
  }

  // ── Helpers ──

  nomePaciente(id: number): string {
    return this.pacientesDict()[id] ?? `Paciente ${id}`;
  }

  nomeServico(id: number): string {
    return this.servicosDict()[id] ?? `Serviço ${id}`;
  }

  nomeProfissional(id: number): string {
    return this.usuariosDict()[id] ?? `Profissional ${id}`
  }

  formatarDataCurta(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  formatarValor(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  isHoje(iso: string): boolean {
    const d = new Date(iso);
    const hoje = new Date();
    return (
      d.getDate() === hoje.getDate() &&
      d.getMonth() === hoje.getMonth() &&
      d.getFullYear() === hoje.getFullYear()
    );
  }

  private mesAtual(): string {
    return new Date().toISOString().slice(0, 7);
  }
}