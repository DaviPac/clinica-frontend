import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { ServicoService } from '../../../core/services/servico/servico.service';

import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AgendamentosStatusModalComponent } from '../agendamentos-status-modal/agendamentos-status-modal.component';
import { formatarDataHora, formatarHora } from '../../../core/utils/data.utils';

@Component({
  selector: 'app-agendamento-detalhes',
  standalone: true,
  imports: [
    CommonModule,
    StatusBadgeComponent,
    AgendamentosStatusModalComponent,
  ],
  templateUrl: './agendamento-detalhes.component.html',
  styleUrl: './agendamento-detalhes.component.css' // Opcional, pode usar o mesmo CSS da lista se desejar global
})
export class AgendamentoDetalhesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private pacienteService = inject(PacienteService);
  private usuarioService = inject(UsuarioService);
  private servicoService = inject(ServicoService);
  private service = inject(AgendamentoService);

  agendamento = signal<Agendamento | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  isAdmin = this.authService.isAdmin;

  pacientesDict = signal<Record<number, string>>({});
  usuariosDict = signal<Record<number, string>>({});
  servicosDict = signal<Record<number, string>>({});

  // Controles de Modais e Ações
  agendamentoParaStatus = signal<Agendamento | null>(null);
  atualizandoPagamento = signal<boolean>(false);
  
  agendamentoParaConfirmarPagamento = signal<Agendamento | null>(null);
  agendamentoParaCancelarPagamento = signal<Agendamento | null>(null);
  
  agendamentoParaCancelarSerie = signal<Agendamento | null>(null);
  cancelandoSerie = signal(false);

  editandoValor = signal(false);
  novoValor = signal<number | null>(null);
  atualizandoValor = signal(false);
  atualizarValorRecorrente = signal(false);

  formatarDataHora = formatarDataHora;
  formatarHora = formatarHora;

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.carregarDadosBase(Number(idParam));
    } else {
      this.erro.set('ID de agendamento inválido.');
      this.carregando.set(false);
    }
  }

  voltar() {
    this.router.navigate(['/agendamentos']);
  }

  carregarDadosBase(id: number) {
    this.carregando.set(true);
    
    // Busca os dicionários primeiro para mapear os IDs para Nomes
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
        
        this.carregarAgendamento(id);
      },
      error: (err) => {
        this.erro.set('Erro ao carregar dados auxiliares: ' + err.message);
        this.carregando.set(false);
      }
    });
  }

  carregarAgendamento(id: number) {
    // Assumindo que o AgendamentoService possui um método obterPorId
    this.service.obterPorId(id).subscribe({
      next: (ag) => {
        this.agendamento.set(ag);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao carregar agendamento: ' + err.message);
        this.carregando.set(false);
      }
    });
  }

  // --- Ações de Pagamento ---

  iniciarTogglePagamento() {
    const ag = this.agendamento();
    if (!ag) return;

    const vaiBaixar = !ag.pago_pelo_paciente;

    if (ag.valor_pacote != null) {
      if (vaiBaixar) this.agendamentoParaConfirmarPagamento.set(ag);
      else this.agendamentoParaCancelarPagamento.set(ag);
    } else {
      this.executarTogglePagamento(ag);
    }
  }

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

  private executarTogglePagamento(ag: Agendamento) {
    this.atualizandoPagamento.set(true);
    this.service.atualizarPagamento(ag.id, !ag.pago_pelo_paciente).subscribe({
      next: () => {
        this.atualizandoPagamento.set(false);
        this.carregarAgendamento(ag.id); // Recarrega os dados locais
      },
      error: (err: Error) => {
        this.erro.set('Erro ao atualizar pagamento: ' + err.message);
        this.atualizandoPagamento.set(false);
      },
    });
  }

  // --- Ações de Status ---

  abrirModalStatus() {
    const ag = this.agendamento();
    if (ag) this.agendamentoParaStatus.set(ag);
  }

  onStatusAtualizado(payload: { id: number; status: StatusAgendamento }) {
    this.agendamentoParaStatus.set(null);
    if (this.agendamento()) {
      this.carregarAgendamento(this.agendamento()!.id);
    }
  }

  // --- Ações de Série / Recorrência ---

  confirmarCancelamentoSerie() {
    const ag = this.agendamento();
    if (ag) this.agendamentoParaCancelarSerie.set(ag);
  }

  cancelarSerie() {
    const ag = this.agendamentoParaCancelarSerie();
    if (!ag?.recorrencia_group_id) return;

    this.cancelandoSerie.set(true);
    this.service.cancelarRecorrencia(ag.recorrencia_group_id).subscribe({
      next: () => {
        this.agendamentoParaCancelarSerie.set(null);
        this.cancelandoSerie.set(false);
        this.carregarAgendamento(ag.id);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao cancelar série: ' + err.message);
        this.cancelandoSerie.set(false);
        this.agendamentoParaCancelarSerie.set(null);
      },
    });
  }

  formatarValor(v: number | null | undefined): string {
    if (v == null) return 'R$ 0,00';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }



  iniciarEdicaoValor() {
    const ag = this.agendamento();
    if (!ag) return;
    this.novoValor.set(ag.valor_combinado);
    this.atualizarValorRecorrente.set(false);
    this.editandoValor.set(true);
  }

  cancelarEdicaoValor() {
    this.editandoValor.set(false);
    this.novoValor.set(null);
  }

  confirmarAtualizacaoValor() {
    const ag = this.agendamento();
    const valor = this.novoValor();
    if (!ag || valor == null || valor < 0) return;

    this.atualizandoValor.set(true);
    this.service.atualizarValor(ag.id, valor, this.atualizarValorRecorrente()).subscribe({
      next: () => {
        this.editandoValor.set(false);
        this.atualizandoValor.set(false);
        this.carregarAgendamento(ag.id);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao atualizar valor: ' + err.message);
        this.atualizandoValor.set(false);
      }
    });
  }
}