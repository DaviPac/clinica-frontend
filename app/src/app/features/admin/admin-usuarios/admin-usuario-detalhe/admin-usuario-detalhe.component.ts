import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  UsuarioService,
  AtualizarUsuarioDto,
} from '../../../../core/services/usuario/usuario.service';
import { Role, Usuario } from '../../../../core/models/usuario.model';

@Component({
  selector: 'app-usuario-detalhe',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './admin-usuario-detalhe.component.html',
})
export class AdminUsuarioDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(UsuarioService);
  private fb = inject(FormBuilder);

  usuario = signal<Usuario | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  modalAberto = signal(false);
  salvando = signal(false);
  erroSalvar = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['PROFISSIONAL' as Role, [Validators.required]],
    profissao: [''],
    taxaComissaoPadrao: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    profissionalRecebe: [false],
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(id)) {
      this.erro.set('Usuário não encontrado.');
      this.carregando.set(false);
      return;
    }

    this.service.buscarPorId(id).subscribe({
      next: u => {
        this.usuario.set(u);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  rotuloRole(role: Role): string {
    return role === 'ADMIN' ? 'Administrador' : 'Profissional';
  }

  formatarData(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  /** Backend guarda a taxa em pontos percentuais (ex.: 30 = 30%). */
  formatarComissao(taxa: number | null | undefined): string {
    if (taxa === null || taxa === undefined) return '—';
    const valor = taxa.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return `${valor}%`;
  }

  abrirModal() {
    const u = this.usuario();
    if (!u) return;

    this.erroSalvar.set(null);
    this.form.reset({
      nome: u.nome,
      email: u.email,
      role: u.role,
      profissao: u.profissao ?? '',
      taxaComissaoPadrao: u.taxaComissaoPadrao ?? 0,
      profissionalRecebe: u.profissionalRecebe,
    });
    this.modalAberto.set(true);
  }

  fecharModal() {
    if (this.salvando()) return;
    this.modalAberto.set(false);
  }

  salvar() {
    const u = this.usuario();
    if (!u) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    // Admin tambem atende: dados de atendimento valem para as duas roles
    const atualizacao = {
      nome: v.nome.trim(),
      email: v.email.trim(),
      role: v.role,
      profissao: v.profissao.trim() || null,
      taxaComissaoPadrao: v.taxaComissaoPadrao,
      profissionalRecebe: v.profissionalRecebe,
    };

    const dto: AtualizarUsuarioDto = {
      ...atualizacao,
      profissao: atualizacao.profissao ?? undefined,
    };

    this.salvando.set(true);
    this.erroSalvar.set(null);

    this.service.atualizar(u.id, dto).subscribe({
      next: atualizado => {
        // Atualiza localmente sem sair da tela
        this.usuario.set(atualizado ?? { ...u, ...atualizacao });
        this.modalAberto.set(false);
        this.salvando.set(false);
      },
      error: (err: Error) => {
        this.erroSalvar.set(err.message);
        this.salvando.set(false);
      },
    });
  }
}