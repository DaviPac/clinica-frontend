import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento, StatusAgendamento } from '../../../core/models/agendamento.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ProntuarioService } from '../../../core/services/prontuario/prontuario.service';
import { AnotacoesService } from '../../../core/services/anotacoes/anotacoes.service';
import { DocumentoSalvo, ProntuarioVersao } from '../../../core/models/prontuario.model';
import { CarregandoComponent } from '../../../shared/ui/carregando/carregando.component';

import { AgendamentosStatusModalComponent } from '../agendamentos-status-modal/agendamentos-status-modal.component';
import { formatarDataHora, formatarHora, toRFC3339Brasilia } from '../../../core/utils/data.utils';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DetalheAcoesComponent } from '../detalhe-acoes/detalhe-acoes.component';
import { DetalheEstadoComponent } from '../detalhe-estado/detalhe-estado.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginaComponent } from '../../../shared/ui/pagina/pagina.component';
import { CartaoComponent } from '../../../shared/ui/cartao/cartao.component';
import { ItemDescricaoComponent } from '../../../shared/ui/item-descricao/item-descricao.component';
import { BotaoComponent } from '../../../shared/ui/botao/botao.component';
import { CampoComponent } from '../../../shared/ui/campo/campo.component';
import { CampoFormComponent } from '../../../shared/ui/campo-form/campo-form.component';
import { DestaqueValorComponent } from '../../../shared/ui/destaque-valor/destaque-valor.component';
import { CaixaMarcacaoComponent } from '../../../shared/ui/caixa-marcacao/caixa-marcacao.component';

@Component({
  selector: 'app-agendamento-detalhes',
  standalone: true,
  imports: [CommonModule,
    AgendamentosStatusModalComponent,
    AlertComponent,
    ConfirmDialogComponent,
    ModalComponent, DetalheAcoesComponent, DetalheEstadoComponent, PaginaComponent, CartaoComponent, ItemDescricaoComponent, BotaoComponent, CampoComponent, CampoFormComponent, DestaqueValorComponent, CaixaMarcacaoComponent, CarregandoComponent],
  templateUrl: './agendamento-detalhes.component.html',
  styleUrl: './agendamento-detalhes.component.css' // Opcional, pode usar o mesmo CSS da lista se desejar global
})
export class AgendamentoDetalhesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private service = inject(AgendamentoService);
  private prontuarioService = inject(ProntuarioService);
  private anotacoesService = inject(AnotacoesService);

  agendamento = signal<Agendamento | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  isAdmin = this.authService.isAdmin;

  // Prontuário: só o profissional da sessão vê e edita — nem o admin.
  ehDoUsuario = computed(() => {
    const ag = this.agendamento();
    const usuario = this.authService.usuario();
    return !!ag && !!usuario && ag.profissionalId === usuario.id;
  });
  /** Versão atual; null = sem prontuário; undefined = ainda não buscado. */
  prontuario = signal<ProntuarioVersao | null | undefined>(undefined);
  carregandoProntuario = signal(false);
  erroProntuario = signal<string | null>(null);

  /** undefined = ainda não buscadas; null = a sessão não tem anotações. */
  anotacoes = signal<DocumentoSalvo | null | undefined>(undefined);
  carregandoAnotacoes = signal(false);
  erroAnotacoes = signal<string | null>(null);

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

  reagendando = signal(false);
  novoInicioReagendamento = signal<string>('');
  novaDuracaoMinutos = signal<number | null>(null);
  reagendarSerie = signal(false);
  intervaloSemanasReagendamento = signal<number>(1);
  salvandoReagendamento = signal(false);

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
    this.carregarAgendamento(id)
  }

  carregarAgendamento(id: number) {
    // Assumindo que o AgendamentoService possui um método obterPorId
    this.service.obterPorId(id).subscribe({
      next: (ag) => {
        this.agendamento.set(ag);
        this.carregando.set(false);
        // Recarregar o agendamento (pagamento, status…) não mexe no prontuário
        if (this.ehDoUsuario() && this.prontuario() === undefined) {
          this.carregarProntuario(id);
        }
        if (this.ehDoUsuario() && this.anotacoes() === undefined) {
          this.carregarAnotacoes(id);
        }
      },
      error: (err: Error) => {
        this.erro.set('Erro ao carregar agendamento: ' + err.message);
        this.carregando.set(false);
      }
    });
  }

  // --- Prontuário ---

  carregarProntuario(id: number) {
    this.carregandoProntuario.set(true);
    this.erroProntuario.set(null);
    this.prontuarioService.obter(id).subscribe({
      next: (versao) => {
        this.prontuario.set(versao);
        this.carregandoProntuario.set(false);
      },
      error: (err: Error) => {
        if (this.prontuarioService.naoExiste(err)) this.prontuario.set(null);
        else this.erroProntuario.set('Erro ao carregar prontuário: ' + err.message);
        this.carregandoProntuario.set(false);
      },
    });
  }

  abrirProntuario() {
    const ag = this.agendamento();
    if (ag) this.router.navigate(['/agendamentos', ag.id, 'prontuario']);
  }

  // --- Anotações ---

  carregarAnotacoes(id: number) {
    this.carregandoAnotacoes.set(true);
    this.erroAnotacoes.set(null);
    this.anotacoesService.obter(id).subscribe({
      next: (anotacoes) => {
        this.anotacoes.set(anotacoes);
        this.carregandoAnotacoes.set(false);
      },
      error: (err: Error) => {
        if (this.anotacoesService.naoExiste(err)) this.anotacoes.set(null);
        else this.erroAnotacoes.set('Erro ao carregar anotações: ' + err.message);
        this.carregandoAnotacoes.set(false);
      },
    });
  }

  abrirAnotacoes() {
    const ag = this.agendamento();
    if (ag) this.router.navigate(['/agendamentos', ag.id, 'anotacoes']);
  }

  // --- Ações de Pagamento ---

  iniciarTogglePagamento() {
    const ag = this.agendamento();
    if (!ag) return;

    const vaiBaixar = !ag.pagoPeloPaciente;

    if (ag.valorPacote != null) {
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
    this.service.atualizarPagamento(ag.id, !ag.pagoPeloPaciente).subscribe({
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
    if (!ag?.recorrenciaGroupId) return;

    this.cancelandoSerie.set(true);
    this.service.cancelarRecorrencia(ag.recorrenciaGroupId).subscribe({
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

  // --- Reagendamento ---

  iniciarReagendamento() {
    const ag = this.agendamento();
    if (!ag) return;
    const inicio = new Date(ag.dataHoraInicio);
    const fim = new Date(ag.dataHoraFim);
    this.novoInicioReagendamento.set(this.paraInputDateTimeLocal(inicio));
    this.novaDuracaoMinutos.set(Math.round((fim.getTime() - inicio.getTime()) / 60000));
    this.reagendarSerie.set(false);
    this.intervaloSemanasReagendamento.set(1);
    this.reagendando.set(true);
  }

  cancelarReagendamento() {
    this.reagendando.set(false);
  }

  confirmarReagendamento() {
    const ag = this.agendamento();
    const inicioStr = this.novoInicioReagendamento();
    const duracao = this.novaDuracaoMinutos();
    const intervalo = this.intervaloSemanasReagendamento();
    if (!ag || !inicioStr || duracao == null || duracao <= 0) return;
    if (this.reagendarSerie() && intervalo < 1) return;

    const inicio = new Date(inicioStr);
    const fim = new Date(inicio.getTime() + duracao * 60000);

    this.salvandoReagendamento.set(true);
    this.service.reagendar(ag.id, toRFC3339Brasilia(inicio), toRFC3339Brasilia(fim), this.reagendarSerie(), intervalo).subscribe({
      next: () => {
        this.reagendando.set(false);
        this.salvandoReagendamento.set(false);
        this.carregarAgendamento(ag.id);
      },
      error: (err: Error) => {
        this.erro.set('Erro ao reagendar: ' + err.message);
        this.salvandoReagendamento.set(false);
      },
    });
  }

  private paraInputDateTimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  formatarValor(v: number | null | undefined): string {
    if (v == null) return 'R$ 0,00';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }



  iniciarEdicaoValor() {
    const ag = this.agendamento();
    if (!ag) return;
    this.novoValor.set(ag.valorCombinado);
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
