import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { UsuarioService } from '../../../../core/services/usuario/usuario.service';
import { Role, Usuario } from '../../../../core/models/usuario.model';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginaComponent } from '../../../../shared/ui/pagina/pagina.component';
import { LinkVoltarComponent } from '../../../../shared/ui/link-voltar/link-voltar.component';
import { CarregandoComponent } from '../../../../shared/ui/carregando/carregando.component';
import { CartaoComponent } from '../../../../shared/ui/cartao/cartao.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ItemDescricaoComponent } from '../../../../shared/ui/item-descricao/item-descricao.component';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { MensagemService } from '../../../../shared/components/mensagem/mensagem.service';
import { FormularioService } from '../../../../shared/components/formulario/formulario.service';
import { CampoAlternador, CampoNumero, CampoSelecao, CampoTexto } from '../../../../shared/components/formulario/campos';

@Component({
  selector: 'app-usuario-detalhe',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    AlertComponent,
    PaginaComponent,
    LinkVoltarComponent,
    CarregandoComponent,
    CartaoComponent,
    AvatarComponent,
    ItemDescricaoComponent,
  ],
  templateUrl: './admin-usuario-detalhe.component.html',
  styleUrl: './admin-usuario-detalhe.component.css',
})
export class AdminUsuarioDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(UsuarioService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private mensagem = inject(MensagemService);
  private formulario = inject(FormularioService);

  usuario = signal<Usuario | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  get mesmoUsuario() {
    return this.usuario()?.id === this.auth.usuario()?.id
  }

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

  abrirFormulario() {
    const u = this.usuario();
    if (!u) return;

    this.formulario.abrir({
      titulo: 'Editar usuário',
      posicaoAvisos: 'rodape',
      valores: {
        nome: u.nome,
        email: u.email,
        role: u.role,
        profissao: u.profissao ?? '',
        taxaComissaoPadrao: u.taxaComissaoPadrao,
        profissionalRecebe: u.profissionalRecebe,
        alterarProximasComissoes: false
      },
      campos: [
        new CampoTexto({
          chave: 'nome', rotulo: 'Nome', obrigatorio: true
        }),
        new CampoTexto({
          chave: 'email', rotulo: 'E-mail', formato: 'email', obrigatorio: true
        }),
        new CampoSelecao({
          chave: 'role', rotulo: 'Perfil de acesso', obrigatorio: true,
          opcoes: [
            { valor: 'PROFISSIONAL', rotulo: 'Profissional' },
            { valor: 'ADMIN', rotulo: 'Administrador' }
          ]
        }),
        new CampoTexto({ chave: 'profissao', rotulo: 'Profissão', placeholder: 'Fisioterapeuta, psicólogo...' }),
        new CampoNumero({
          chave: 'taxaComissaoPadrao', rotulo: 'Comissão padrão da clínica (%)',
          obrigatorio: true, minimo:0, maximo: 100, passo: 0.5
        }),
        new CampoSelecao({
          chave: 'profissionalRecebe', rotulo: 'Fluxo de pagamento', apresentacao: 'radio',
          opcoes: [
            { valor: true, rotulo: 'Profissional recebe', descricao: 'O paciente paga direto ao profissional, que repassa a comissão à clínica.' },
            { valor: false, rotulo: 'Clínica recebe', descricao: 'A clínica recebe o pagamento e repassa ao profissional, descontando a comissão.' }
          ]
        }),
        new CampoAlternador({
          chave: 'alterarProximasComissoes', rotulo: 'Alterar próximas comissões', apresentacao: 'caixa',
          visivel: ctx => ctx.valores['taxaComissaoPadrao'] !== u.taxaComissaoPadrao || ctx.valores['profissionalRecebe'] !== u.profissionalRecebe
        })
      ],
      aoConfirmar: v => this.service.atualizar(u.id, {
        nome: v.nome.trim(),
        email: v.email.trim(),
        role: v.role,
        profissao: v.profissao.trim() || undefined,
        taxaComissaoPadrao: v.taxaComissaoPadrao ?? 0,
        profissionalRecebe: v.profissionalRecebe,
        alterarProximasComissoes: v.alterarProximasComissoes
      })
    }).subscribe(r => {
      if (!r) {
        return;
      }
      if (r.resposta) {
        this.usuario.set(r.resposta)
      }
      else {
        this.service.buscarPorId(u.id).subscribe(atualizado => this.usuario.set(atualizado));
      }
    })
  }

  deletar() {
    const id = this.usuario()?.id;
    if (!id || this.auth.usuario()?.id === id) {
      return;
    }

    this.mensagem.confirmar({
      titulo: "Deletar usuário",
      mensagem: "Deseja deletar este usuário?",
      variante: "perigo",
      aoConfirmar: () => this.service.deletar(id)
    }).subscribe((ok) => {
      if (ok) {
        this.router.navigate(['/admin/usuarios'])
      }
    })
  }
}
