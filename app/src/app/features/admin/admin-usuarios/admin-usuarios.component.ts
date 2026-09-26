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

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    ModalComponent, PaginaComponent, CabecalhoPaginaComponent, BotaoComponent, CarregandoComponent, TabelaComponent, VazioComponent, SeloComponent, CampoFormComponent, CampoComponent],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.css',
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
      // O HTML já declarava min=0 max=100, mas atributo não bloqueia submit:
      // sem estes validadores passava 250% ou valor negativo.
      taxaComissaoPadrao: [40, [Validators.required, Validators.min(0), Validators.max(100)]],
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
      taxaComissaoPadrao: raw.taxaComissaoPadrao,
    };

    this.service.registrar(dto).subscribe({
      next: novo => {
        this.usuarios.update(lista => [...lista, novo]);
        this.form.reset({
          nome: '', email: '', senha: '',
          role: 'PROFISSIONAL', profissao: '',
          taxaComissaoPadrao: 40,
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