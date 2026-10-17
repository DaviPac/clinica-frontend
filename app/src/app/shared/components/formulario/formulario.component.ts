import { Component, OnDestroy, OnInit, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AlertComponent } from '../alert/alert.component';
import { ToggleComponent } from '../toggle/toggle.component';
import { MensagemService } from '../mensagem/mensagem.service';
import { CampoFormComponent } from '../../ui/campo-form/campo-form.component';
import { CampoComponent } from '../../ui/campo/campo.component';
import { CampoSenhaComponent } from '../../ui/campo-senha/campo-senha.component';
import { CaixaMarcacaoComponent } from '../../ui/caixa-marcacao/caixa-marcacao.component';
import { BotaoComponent } from '../../ui/botao/botao.component';
import { EstadoFormulario, VistaCampo } from './estado-formulario';
import { BotoesFormulario, DefinicaoFormulario, ResultadoFormulario } from './formulario.model';

let proximoId = 0;

/**
 * Formulário montado a partir de uma `DefinicaoFormulario`, dentro da página:
 *
 *   formSenha = definirFormulario({
 *     campos: [...],
 *     aoConfirmar: v => this.auth.mudarSenha(v),
 *     aoConcluir: (_, ctx) => { ctx.redefinir(); ctx.avisar('Senha alterada.', 'success', 4000); },
 *   });
 *
 *   <app-formulario [definicao]="formSenha" />
 *
 * A definição é lida uma vez, ao montar. Para controlar de fora, há os
 * eventos e o `estado` (via viewChild): `estado.ctx.definir(...)`,
 * `estado.enviar()` etc. Num diálogo, use o `FormularioService`.
 */
@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [
    NgTemplateOutlet, ReactiveFormsModule, AlertComponent, ToggleComponent, CampoFormComponent, CampoComponent,
    CampoSenhaComponent, CaixaMarcacaoComponent, BotaoComponent,
  ],
  templateUrl: './formulario.component.html',
  styleUrl: './formulario.component.css',
})
export class FormularioComponent implements OnInit, OnDestroy {
  private readonly mensagem = inject(MensagemService);

  readonly definicao = input.required<DefinicaoFormulario<any, any>>();

  readonly enviado = output<ResultadoFormulario<any, any>>();
  readonly cancelado = output<void>();
  /** A cada mudança de valor — inclusive as feitas pelos ganchos. */
  readonly alterado = output<Record<string, any>>();
  /** Ao montar e sempre que a validade muda. */
  readonly validade = output<boolean>();
  readonly processandoMudou = output<boolean>();

  readonly id = `formulario-${++proximoId}`;
  estado!: EstadoFormulario<any>;
  botoes: BotoesFormulario | false = {};

  ngOnInit() {
    const def = this.definicao();
    this.botoes = def.botoes ?? {};
    this.estado = new EstadoFormulario(def, this.mensagem, this.id);

    this.estado.enviado.subscribe(r => this.enviado.emit(r));
    this.estado.valoresMudaram.subscribe(v => this.alterado.emit(v));
    this.estado.validadeMudou.subscribe(v => this.validade.emit(v));
    this.estado.processandoMudou.subscribe(v => this.processandoMudou.emit(v));
    this.validade.emit(this.estado.valido());
  }

  ngOnDestroy() {
    this.estado?.destruir();
  }

  get bloqueado() {
    return this.estado.processando()
      || (this.definicao().modoValidacao === 'bloquear' && !this.estado.valido());
  }

  estadoVisual(vista: VistaCampo) {
    const erro = this.estado.erroDe(vista);
    return !erro ? 'normal' : erro.tom === 'aviso' ? 'aviso' : 'invalido';
  }

  alternar(vista: VistaCampo, valor: boolean) {
    vista.controle.setValue(valor);
    vista.controle.markAsDirty();
  }
}
