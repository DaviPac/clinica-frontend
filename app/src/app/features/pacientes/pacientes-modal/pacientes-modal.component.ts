import { Component, OnInit, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-pacientes-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, AlertComponent],
  templateUrl: './pacientes-modal.component.html',
})
export class PacientesModalComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private fb = inject(FormBuilder);
  private service = inject(PacienteService);

  isAdmin = this.authService.isAdmin();

  fechar = output<void>();
  salvo = output<void>();

  form: FormGroup;

  usuarios = signal<any[]>([]);
  loading = signal(false);
  erro = signal<string | null>(null);
  avisoVinculacao = signal(false);
  submetido = signal(false);

  constructor() {
    const usuarioAtualId = this.authService.usuario()?.id || 0;
    this.form = this.fb.nonNullable.group({
      usuario_id: [usuarioAtualId],
      nome: ['', [Validators.required, Validators.minLength(3)]],
      cpf: [''],
      telefone: [''],
      dataNascimento: [''],
      rg: [''],
      enderecoCompleto: [''],
    });
    if (this.isAdmin) {
      this.form.controls['usuario_id'].addValidators([Validators.required, Validators.min(1)]);
    }
  }

  ngOnInit() {
    if (this.isAdmin) {
      this.usuarioService.listar().subscribe(u => this.usuarios.set(u));
    }
  }

  campoInvalido(nome: string): boolean {
    const c = this.form.get(nome);
    if (!c) return false;
    return c.invalid && (c.touched || this.submetido());
  }

  submit() {
    this.submetido.set(true);
    this.erro.set(null);
    this.avisoVinculacao.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const raw = this.form.getRawValue();
    const dto = {
      nome: raw.nome.trim(),
      cpf: raw.cpf.trim(),
      ...(raw.telefone ? { telefone: raw.telefone.trim() } : {}),
      ...(raw.dataNascimento ? { dataNascimento: raw.dataNascimento } : {}),
      ...(raw.rg ? { rg: raw.rg.trim() } : {}),
      ...(raw.enderecoCompleto ? { enderecoCompleto: raw.enderecoCompleto.trim() } : {}),
    };

    let profissionalId: string | undefined;
    if (this.isAdmin && raw.usuario_id) {
      profissionalId = raw.usuario_id.toString();
    }

    this.service.criar(dto, profissionalId).subscribe({
      next: res => {
        if (res.status === 200) {
          this.avisoVinculacao.set(true);
          this.loading.set(false);
          setTimeout(() => this.salvo.emit(), 1500);
        } else {
          this.loading.set(false);
          this.salvo.emit();
        }
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.loading.set(false);
      },
    });
  }
}