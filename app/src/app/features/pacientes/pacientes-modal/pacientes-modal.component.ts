import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { PacienteService } from '../../../core/services/paciente/paciente.service';

@Component({
  selector: 'app-pacientes-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pacientes-modal.component.html',
})
export class PacientesModalComponent {
  // Signals de saída (Angular 17+)
  fechar = output<void>();
  salvo = output<void>();

  form: FormGroup;

  loading = signal(false);
  erro = signal<string | null>(null);

  // Informa se o paciente já existia no sistema (vinculação vs criação)
  avisoVinculacao = signal(false);

  constructor(
    private fb: FormBuilder,
    private service: PacienteService
  ) {
    this.form = fb.nonNullable.group({
    nome: ['', Validators.required],
    cpf: ['', Validators.required],
    telefone: [''],
    data_nascimento: [''],
  });
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

    this.service.criar(dto).subscribe({
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