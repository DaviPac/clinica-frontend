import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
})
export class PerfilComponent {
  salvando = signal(false);
  erro = signal<string | null>(null);
  sucesso = signal<string | null>(null);
  mostrarSenhaAntiga = signal(false);
  mostrarNovaSenha = signal(false);
  mostrarConfirmar = signal(false);

  form: FormGroup;

  // Dados do usuário logado
  readonly usuario = computed(() => this.auth.usuario());
  readonly isAdmin = computed(() => this.auth.isAdmin());

  get iniciais(): string {
    const nome = this.usuario()?.nome ?? '';
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
  ) {
    this.form = this.fb.nonNullable.group(
      {
        senhaAntiga:   ['', Validators.required],
        novaSenha:     ['', [Validators.required, Validators.minLength(6)]],
        confirmarNova: ['', Validators.required],
      },
      { validators: [this.senhasIguaisValidator] },
    );
  }

  formatarData(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private senhasIguaisValidator(group: AbstractControl): ValidationErrors | null {
    const nova = group.get('novaSenha')?.value;
    const confirmar = group.get('confirmarNova')?.value;
    return nova && confirmar && nova !== confirmar ? { senhasDiferentes: true } : null;
  }

  get senhasDiferentes(): boolean {
    return this.form.hasError('senhasDiferentes')
      && !!this.form.get('confirmarNova')?.touched;
  }

  submit() {
    this.erro.set(null);
    this.sucesso.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.salvando.set(true);
    const { senhaAntiga, novaSenha } = this.form.getRawValue();

    this.auth.mudarSenha({ senhaAntiga, novaSenha }).subscribe({
      next: () => {
        this.salvando.set(false);
        this.sucesso.set('Senha alterada com sucesso.');
        this.form.reset({ senhaAntiga: '', novaSenha: '', confirmarNova: '' });
        this.mostrarSenhaAntiga.set(false);
        this.mostrarNovaSenha.set(false);
        this.mostrarConfirmar.set(false);

        // Some o sucesso depois de alguns segundos
        setTimeout(() => this.sucesso.set(null), 4000);
      },
      error: (err: Error) => {
        this.salvando.set(false);
        this.erro.set(err.message || 'Não foi possível alterar a senha.');
      },
    });
  }

  logout() {
    this.auth.logout();
  }
}