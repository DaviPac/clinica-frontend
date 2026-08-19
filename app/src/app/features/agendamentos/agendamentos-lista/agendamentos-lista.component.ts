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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FiltroProfissionalComponent } from '../../../shared/components/filtro-profissional/filtro-profissional.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

type ModoVisualizacao = 'mensal' | 'semanal';

interface DiaCalendario {
  diaNumero: number | null;
  agendamentos: Agendamento[];
  isToday: boolean;
}

interface DiaSemana {
  data: Date;
  diaNumero: number;
  nomeDia: string;
  agendamentos: Agendamento[];
  isToday: boolean;
}

@Component({
  selector: 'app-agendamentos-lista',
  standalone: true,
  imports: [
    CommonModule, FormsModule, StatusBadgeComponent,
    AgendamentosModalComponent, AgendamentosStatusModalComponent,
    RouterLink, FiltroProfissionalComponent, ToggleComponent,
    AlertComponent, ConfirmDialogComponent
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
  private route = inject(ActivatedRoute);

  agendamentos = signal<Agendamento[]>([]);
  carregando = signal(true);
  erro = signal<string | null>(null);

  isAdmin = this.authService.isAdmin;
  mostrarInativos = signal(false);
  filtroProfissionalId = signal<string | undefined>(undefined);

  // NOVO: modo de visualização (mês x semana) e data de referência única
  modoView = signal<ModoVisualizacao>('mensal');
  dataReferencia = signal<Date>(new Date());

  pacientesDict = signal<Record<number, string>>({});
  usuariosDict = signal<Record<number, string>>({});
  servicosDict = signal<Record<number, string>>({});

  modalCriacaoAberto = signal(false);
  agendamentoParaStatus = signal<Agendamento | null>(null);
  atualizandoPagamento = signal<number | null>(null);
  agendamentoParaCancelarSerie = signal<Agendamento | null>(null);
  cancelandoSerie = signal(false);

  // modal de confirmação de pagamento de pacote
  agendamentoParaConfirmarPagamento = signal<Agendamento | null>(null);
  agendamentoParaCancelarPagamento = signal<Agendamento | null>(null);

  // Retorna o domingo (00:00) da semana que contém a data informada
  private inicioSemana(d: Date): Date {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() - r.getDay()); // getDay(): 0 = domingo
    return r;
  }

  private formatarISO(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // ALTERADO: intervalo depende do modo (mês inteiro ou semana)
  filtro = computed(() => {
    const ref = this.dataReferencia();
    let inicio: Date;
    let fim: Date;

    if (this.modoView() === 'semanal') {
      inicio = this.inicioSemana(ref);
      fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
    } else {
      inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
      fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    }

    return { de: this.formatarISO(inicio), ate: this.formatarISO(fim) };
  });

  labelPeriodo = computed(() => {
    const ref = this.dataReferencia();

    if (this.modoView() === 'semanal') {
      const inicio = this.inicioSemana(ref);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return `${fmt(inicio)} – ${fmt(fim)} de ${fim.getFullYear()}`;
    }

    const mes = ref.toLocaleDateString('pt-BR', { month: 'long' });
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} de ${ref.getFullYear()}`;
  });

  subtituloPeriodo = computed(() =>
    this.modoView() === 'semanal' ? 'Visão Semanal da Agenda' : 'Visão Mensal da Agenda'
  );

  private filtrarPorData(dataStr: string): Agendamento[] {
    let ags = this.agendamentos().filter(a => a.dataHoraInicio.startsWith(dataStr));
    if (!this.mostrarInativos()) {
      ags = ags.filter(a => a.status !== 'CANCELADO');
    }
    return ags;
  }

  // Grade mensal (com células vazias para alinhar o 1º dia)
  diasCalendario = computed<DiaCalendario[]>(() => {
    const data = this.dataReferencia();
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias: DiaCalendario[] = [];
    const hoje = new Date();

    for (let i = 0; i < primeiroDia.getDay(); i++) {
      dias.push({ diaNumero: null, agendamentos: [], isToday: false });
    }

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
      dias.push({ diaNumero: d, agendamentos: this.filtrarPorData(dataStr), isToday });
    }

    return dias;
  });

  // NOVO: grade semanal (7 dias, domingo -> sábado)
  diasSemana = computed<DiaSemana[]>(() => {
    const inicio = this.inicioSemana(this.dataReferencia());
    const hoje = new Date();
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dias: DiaSemana[] = [];

    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      const dataStr = this.formatarISO(dia);
      dias.push({
        data: dia,
        diaNumero: dia.getDate(),
        nomeDia: nomes[dia.getDay()],
        agendamentos: this.filtrarPorData(dataStr),
        isToday: dia.toDateString() === hoje.toDateString(),
      });
    }

    return dias;
  });

  ngOnInit() {
    this.restaurarFiltrosDaUrl();
    this.carregarDadosBase();
  }

  // Restaura mês/semana, data, profissional e "mostrar canceladas" ao voltar para a tela
  private restaurarFiltrosDaUrl() {
    const params = this.route.snapshot.queryParamMap;

    if (params.get('modo') === 'semanal') this.modoView.set('semanal');

    const data = params.get('data');
    if (data) {
      const [ano, mes, dia] = data.split('-').map(Number);
      if (ano && mes && dia) this.dataReferencia.set(new Date(ano, mes - 1, dia));
    }

    const profissionalId = params.get('profissional_id');
    if (profissionalId) this.filtroProfissionalId.set(profissionalId);

    if (params.get('inativos') === '1') this.mostrarInativos.set(true);
  }

  private sincronizarUrl() {
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        modo: this.modoView() === 'semanal' ? 'semanal' : null,
        data: this.formatarISO(this.dataReferencia()),
        profissional_id: this.filtroProfissionalId() ?? null,
        inativos: this.mostrarInativos() ? '1' : null,
      },
    });
  }

  carregarDadosBase() {
    this.carregando.set(true);
    forkJoin({
      pacientes: this.pacienteService.listar(true),
      usuarios: this.isAdmin() ? this.usuarioService.listar() : of([this.authService.usuario()]),
      servicos: this.servicoService.listar({ incluirInativos: true })
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

    this.service.listar({ periodo: { de, ate }, profissionalId: this.filtroProfissionalId() }).subscribe({
      next: lista => {
        this.agendamentos.set(
          lista.sort((a, b) => new Date(a.dataHoraInicio).getTime() - new Date(b.dataHoraInicio).getTime())
        );
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  // NOVO: alterna entre mês e semana (recarrega pois o intervalo muda)
  setModoView(modo: ModoVisualizacao) {
    if (this.modoView() === modo) return;
    this.modoView.set(modo);
    this.sincronizarUrl();
    this.carregarAgendamentos();
  }

  // ALTERADO: navega por mês ou por semana conforme o modo atual
  navegar(direcao: 1 | -1) {
    const ref = this.dataReferencia();
    if (this.modoView() === 'semanal') {
      const nova = new Date(ref);
      nova.setDate(ref.getDate() + direcao * 7);
      this.dataReferencia.set(nova);
    } else {
      this.dataReferencia.set(new Date(ref.getFullYear(), ref.getMonth() + direcao, 1));
    }
    this.sincronizarUrl();
    this.carregarAgendamentos();
  }

  // NOVO: volta para o período atual (mês/semana de hoje)
  irParaHoje() {
    this.dataReferencia.set(new Date());
    this.sincronizarUrl();
    this.carregarAgendamentos();
  }

  // intercepta se for pacote e o pagamento for para "pago"
  iniciarTogglePagamento(ag: Agendamento) {
    const vaiBaixar = !ag.pagoPeloPaciente; // true = vai marcar como pago

    if (ag.valorPacote != null) {
      if (vaiBaixar) this.agendamentoParaConfirmarPagamento.set(ag);
      else this.agendamentoParaCancelarPagamento.set(ag)
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
    this.atualizandoPagamento.set(ag.id);
    this.service.atualizarPagamento(ag.id, !ag.pagoPeloPaciente).subscribe({
      next: () => {
        this.atualizandoPagamento.set(null);
        this.carregarAgendamentos();
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

  onStatusAtualizado(payload: { id: number; status: StatusAgendamento }) {
    this.agendamentoParaStatus.set(null);
    this.carregarAgendamentos();
  }

  onAgendamentoCriado() {
    this.modalCriacaoAberto.set(false);
    this.carregarAgendamentos();
  }

  confirmarCancelamentoSerie(ag: Agendamento) {
    this.agendamentoParaCancelarSerie.set(ag);
  }

  cancelarSerie() {
    const ag = this.agendamentoParaCancelarSerie();
    if (!ag?.recorrenciaGroupId) return;

    this.cancelandoSerie.set(true);
    this.service.cancelarRecorrencia(ag.recorrenciaGroupId).subscribe({
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

  onFiltroChange(profissionalId?: string) {
    this.filtroProfissionalId.set(profissionalId);
    this.sincronizarUrl();
    this.carregarAgendamentos()
  }

  onToggleInativos(inativo: boolean) {
    this.mostrarInativos.set(inativo);
    this.sincronizarUrl();
  }
}