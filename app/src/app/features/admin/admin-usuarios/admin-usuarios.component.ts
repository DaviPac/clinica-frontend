import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { Usuario } from '../../../core/models/usuario.model';
import { RouterLink } from '@angular/router';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginaComponent } from '../../../shared/ui/pagina/pagina.component';
import { CabecalhoPaginaComponent } from '../../../shared/ui/cabecalho-pagina/cabecalho-pagina.component';
import { BotaoComponent } from '../../../shared/ui/botao/botao.component';
import { CarregandoComponent } from '../../../shared/ui/carregando/carregando.component';
import { TabelaComponent } from '../../../shared/ui/tabela/tabela.component';
import { VazioComponent } from '../../../shared/ui/vazio/vazio.component';
import { SeloComponent } from '../../../shared/ui/selo/selo.component';
import { CampoFormComponent } from '../../../shared/ui/campo-form/campo-form.component';
import { CampoComponent } from '../../../shared/ui/campo/campo.component';
import { inject } from '@angular/core/primitives/di';
import { FormularioService } from '../../../shared/components/formulario/formulario.service';
import { criarUsuarioForm } from './criar-usuario.form';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    PaginaComponent,
    CabecalhoPaginaComponent,
    BotaoComponent,
    CarregandoComponent,
    TabelaComponent,
    VazioComponent,
    SeloComponent
  ],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.css',
})
export class AdminUsuariosComponent implements OnInit {
  private formulario = inject(FormularioService);
  private service = inject(UsuarioService);

  usuarios = signal<Usuario[]>([]);
  carregando = signal(true);
  salvando = signal(false);
  erro = signal<string | null>(null);

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

  abrirFormulario() {
    this.formulario.abrir({
      ...criarUsuarioForm(),
      aoConfirmar: v => this.service.registrar({
        nome: v.nome,
        email: v.email,
        senha: v.senha,
        role: v.role,
        profissao: v.profissao.trim() || undefined,
        taxaComissaoPadrao: v.taxaComissaoPadrao ?? undefined
      })
    }).subscribe(r => {
        if (r?.resposta) this.usuarios.update(lista => [...lista, r.resposta!]);
      });
  }

  formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}
