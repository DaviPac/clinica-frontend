import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { Paciente } from '../../../core/models/paciente.model';
import { PacientesModalComponent } from '../pacientes-modal/pacientes-modal.component';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Usuario } from '../../../core/models/usuario.model';

@Component({
  selector: 'app-pacientes-lista',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PacientesModalComponent],
  templateUrl: './pacientes-lista.component.html',
})
export class PacientesListaComponent implements OnInit {
  private authService = inject(AuthService)
  private usuarioService = inject(UsuarioService)

  isAdmin = this.authService.isAdmin()
  usuarios = signal<Usuario[]>([]);
  filtroProfissionalId = signal<string | undefined>(undefined);

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
    if (this.isAdmin) {
      this.usuarioService.listar().subscribe(lista => this.usuarios.set(lista));
    }
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    const mostrarTodos = this.isAdmin && !this.filtroProfissionalId();
    this.service.listar(mostrarTodos, this.filtroProfissionalId()).subscribe({
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

  onFiltroChange(valor: string) {
    // valor === '' -> todos; caso contrário -> id do profissional
    this.filtroProfissionalId.set(valor === '' ? undefined : valor);
    this.carregar();
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