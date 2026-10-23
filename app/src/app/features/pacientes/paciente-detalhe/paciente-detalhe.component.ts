import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Paciente } from '../../../core/models/paciente.model';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PaginaComponent } from '../../../shared/ui/pagina/pagina.component';
import { LinkVoltarComponent } from '../../../shared/ui/link-voltar/link-voltar.component';
import { CarregandoComponent } from '../../../shared/ui/carregando/carregando.component';
import { CartaoComponent } from '../../../shared/ui/cartao/cartao.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { ItemDescricaoComponent } from '../../../shared/ui/item-descricao/item-descricao.component';
import { AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { Agendamento } from '../../../core/models/agendamento.model';
import { MensagemService } from '../../../shared/components/mensagem/mensagem.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { VazioComponent } from '../../../shared/ui/vazio/vazio.component';
import { formatarHora } from '../../../core/utils/data.utils';

@Component({
  selector: 'app-paciente-detalhe',
  standalone: true,
  imports: [CommonModule, RouterModule, AlertComponent, ConfirmDialogComponent, PaginaComponent, LinkVoltarComponent, CarregandoComponent, CartaoComponent, AvatarComponent, ItemDescricaoComponent, StatusBadgeComponent, VazioComponent],
  templateUrl: './paciente-detalhe.component.html',
  styleUrl: './paciente-detalhe.component.css',
})
export class PacienteDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PacienteService);
  private agendamentoService = inject(AgendamentoService);
  private mensagem = inject(MensagemService);
  protected auth = inject(AuthService);

  paciente = signal<Paciente | null>(null);
  proximosAgendamentos = signal<Agendamento[]>([]);
  carregando = signal(true);
  erro = signal<string | null>(null);

  modalAberto = signal(false);
  inativando = signal(false);
  erroInativar = signal<string | null>(null);
  acao = signal<'inativar' | 'ativar'>('inativar');

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.service.buscarPorId(id).subscribe({
      next: p => {
        this.paciente.set(p);
        this.buscarAgendamentos();
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  buscarAgendamentos() {
    const agora = new Date();
    const ate = new Date();
    ate.setFullYear(9999);
    this.agendamentoService.listar({
      periodo: { de: agora.toDateString(), ate: ate.toDateString() },
      pacienteId: this.paciente()?.id
    }).subscribe({
      next: agendamentos => {
        this.proximosAgendamentos.set(
          [...agendamentos].sort((a, b) => a.dataHoraInicio.localeCompare(b.dataHoraInicio))
        );
      },
      error: (err: Error) => {
        this.mensagem.erro(err.message, "Erro ao buscar agendamentos");
      }
    })
  }

  formatarHora = formatarHora;

  dia(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit' });
  }

  mes(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  }

  diaSemana(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long' });
  }

  formatarData(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  calcularIdade(iso: string | null): string {
    if (!iso) return '—';
    const nasc = new Date(iso);
    const hoje = new Date();
    const anos = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    const ajuste = m < 0 || (m === 0 && hoje.getDate() < nasc.getDate()) ? 1 : 0;
    return `${anos - ajuste} anos`;
  }

  irParaEdicao() {
    const p = this.paciente();
    if (!p) return;
    this.router.navigate(['/pacientes', p.id, 'editar']);
  }

  abrirModal(acao: 'inativar' | 'ativar') {
    this.acao.set(acao);
    this.erroInativar.set(null);
    this.modalAberto.set(true);
  }

  fecharModal() {
    if (this.inativando()) return;
    this.modalAberto.set(false);
  }

  confirmarAcao() {
    const p = this.paciente();
    if (!p) return;

    this.inativando.set(true);
    this.erroInativar.set(null);

    const obs = this.acao() === 'ativar'
      ? this.service.ativar(String(p.id))
      : this.service.inativar(String(p.id));

    obs.subscribe({
      next: () => {
        if (this.acao() === 'ativar') {
          // Atualiza localmente sem sair da tela
          this.paciente.set({ ...p, ativo: true });
          this.modalAberto.set(false);
          this.inativando.set(false);
        } else {
          // Inativacao: volta para a lista
          this.router.navigate(['/pacientes']);
        }
      },
      error: (err: Error) => {
        this.erroInativar.set(err.message);
        this.inativando.set(false);
      },
    });
  }
}
