import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { Paciente } from '../../../core/models/paciente.model';

@Component({
  selector: 'app-paciente-detalhe',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './paciente-detalhe.component.html',
})
export class PacienteDetalheComponent implements OnInit {
  paciente = signal<Paciente | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private service: PacienteService
  ) {}

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
}