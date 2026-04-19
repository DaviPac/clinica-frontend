import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { Paciente } from '../../../core/models/paciente.model';
import { PacientesModalComponent } from '../pacientes-modal/pacientes-modal.component';

@Component({
  selector: 'app-pacientes-lista',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PacientesModalComponent],
  templateUrl: './pacientes-lista.component.html',
})
export class PacientesListaComponent implements OnInit {
  private todos = signal<Paciente[]>([]);

  busca = '';
  modalAberto = signal(false);
  carregando = signal(true);
  erro = signal<string | null>(null);

  pacientes = computed(() => {
    const termo = this.busca.toLowerCase().trim();
    if (!termo) return this.todos();
    return this.todos().filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      p.cpf.includes(termo)
    );
  });

  constructor(private service: PacienteService) {}

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    this.service.listar().subscribe({
      next: lista => {
        this.todos.set(lista);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  abrirModal() { this.modalAberto.set(true); }

  onPacienteSalvo() {
    this.modalAberto.set(false);
    this.carregar(); // recarrega a lista
  }

  formatarData(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}