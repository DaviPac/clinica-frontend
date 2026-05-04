import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Paciente } from '../../../core/models/paciente.model';

@Component({
  selector: 'app-paciente-detalhe',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './paciente-detalhe.component.html',
})
export class PacienteDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PacienteService);
  protected auth = inject(AuthService);

  paciente = signal<Paciente | null>(null);
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
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
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
          // Inativação: volta para a lista (comportamento anterior)
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