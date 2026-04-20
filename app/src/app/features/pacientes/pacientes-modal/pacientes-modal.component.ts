import { Component, OnInit, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';

@Component({
  selector: 'app-pacientes-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pacientes-modal.component.html',
})
export class PacientesModalComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);

  isAdmin = this.authService.isAdmin();
  
  // Signals de saída (Angular 17+)
  fechar = output<void>();
  salvo = output<void>();

  form: FormGroup;

  usuarios = signal<any[]>([]); // Armazena a lista de profissionais
  loading = signal(false);
  erro = signal<string | null>(null);

  // Informa se o paciente já existia no sistema (vinculação vs criação)
  avisoVinculacao = signal(false);

  constructor(
    private fb: FormBuilder,
    private service: PacienteService
  ) {
    const usuarioAtualId = this.authService.usuario()?.id || 0;

    this.form = fb.nonNullable.group({
      usuario_id: [usuarioAtualId], // Inicializado com o ID logado ou 0
      nome: ['', Validators.required],
      cpf: ['', Validators.required],
      telefone: [''],
      data_nascimento: [''],
    });

    // Se for admin, torna a seleção de profissional obrigatória
    if (this.isAdmin) {
      this.form.controls['usuario_id'].addValidators([Validators.required, Validators.min(1)]);
    }
  }

  ngOnInit() {
    // Carrega a lista de usuários apenas se for admin
    if (this.isAdmin) {
      this.usuarioService.listar().subscribe(u => this.usuarios.set(u));
    }
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.erro.set(null);
    this.avisoVinculacao.set(false);

    const raw = this.form.getRawValue();
    const dto = {
      nome: raw.nome,
      cpf: raw.cpf,
      ...(raw.telefone ? { telefone: raw.telefone } : {}),
      ...(raw.data_nascimento ? { data_nascimento: raw.data_nascimento } : {}),
    };

    let profissionalId: string | undefined = undefined;
    if (this.isAdmin && raw.usuario_id) {
      profissionalId = raw.usuario_id.toString();
    }

    this.service.criar(dto, profissionalId).subscribe({
      next: res => {
        if (res.status === 200) {
          // Paciente já existia — foi vinculado ao profissional
          this.avisoVinculacao.set(true);
          setTimeout(() => this.salvo.emit(), 1500);
        } else {
          // 201 — paciente criado com sucesso
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