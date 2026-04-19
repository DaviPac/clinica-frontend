import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { Usuario } from '../../../core/models/usuario.model';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-usuarios.component.html',
})
export class AdminUsuariosComponent implements OnInit {
  usuarios = signal<Usuario[]>([]);
  modalAberto = signal(false);
  carregando = signal(true);
  salvando = signal(false);
  erro = signal<string | null>(null);
  erroModal = signal<string | null>(null);

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private service: UsuarioService,
  ) {
    this.form = this.fb.nonNullable.group({
      nome:                 ['', Validators.required],
      email:                ['', [Validators.required, Validators.email]],
      senha:                ['', [Validators.required, Validators.minLength(6)]],
      role:                 ['PROFISSIONAL' as 'ADMIN' | 'PROFISSIONAL', Validators.required],
      profissao:            [''],
      taxa_comissao_padrao: [40],
    });
  }

  ngOnInit() { this.carregar(); }

  carregar() {
    this.carregando.set(true);
    this.service.listar().subscribe({
      next: lista => {
        this.usuarios.set(lista);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.salvando.set(true);
    this.erroModal.set(null);

    const raw = this.form.getRawValue();
    const dto = {
      nome: raw.nome,
      email: raw.email,
      senha: raw.senha,
      role: raw.role,
      ...(raw.profissao.trim() ? { profissao: raw.profissao.trim() } : {}),
      taxa_comissao_padrao: raw.taxa_comissao_padrao,
    };

    this.service.registrar(dto).subscribe({
      next: novo => {
        this.usuarios.update(lista => [...lista, novo]);
        this.form.reset({
          nome: '', email: '', senha: '',
          role: 'PROFISSIONAL', profissao: '',
          taxa_comissao_padrao: 40,
        });
        this.modalAberto.set(false);
        this.salvando.set(false);
      },
      error: (err: Error) => {
        this.erroModal.set(err.message);
        this.salvando.set(false);
      },
    });
  }

  formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}