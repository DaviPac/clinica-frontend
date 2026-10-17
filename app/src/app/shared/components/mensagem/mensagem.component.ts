import { Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AlertComponent } from '../alert/alert.component';
import { DadosMensagem } from './mensagem.model';

/** Tom visual de cada tipo: casa com os tokens `--cor-<tom>-*`. */
type Tom = 'marca' | 'info' | 'sucesso' | 'aviso' | 'perigo';

/**
 * Diálogo de mensagem/confirmação. Não é usado direto nos templates:
 * quem abre é o `MensagemService`.
 */
@Component({
  selector: 'app-mensagem',
  standalone: true,
  imports: [NgTemplateOutlet, AlertComponent],
  templateUrl: './mensagem.component.html',
  styleUrl: './mensagem.component.css',
  host: { '[attr.data-tom]': 'tom' },
})
export class MensagemComponent {
  readonly dados = inject<DadosMensagem>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  processando = signal(false);
  erro = signal<string | null>(null);

  readonly confirmacao = this.dados.tipo === 'confirmar';

  readonly tom: Tom = tomDe(this.dados);

  confirmar() {
    const acao = this.dados.aoConfirmar;
    if (!this.confirmacao || !acao) {
      this.ref.close(true);
      return;
    }

    this.processando.set(true);
    this.erro.set(null);
    this.ref.disableClose = true;

    acao().subscribe({
      complete: () => this.ref.close(true),
      error: (err: Error) => {
        this.erro.set(err.message);
        this.processando.set(false);
        this.ref.disableClose = false;
      },
    });
  }

  cancelar() {
    this.ref.close(false);
  }
}

function tomDe({ tipo, variante }: DadosMensagem): Tom {
  switch (tipo) {
    case 'erro': return 'perigo';
    case 'confirmar':
      return variante === 'perigo' ? 'perigo'
        : variante === 'sucesso' ? 'sucesso'
        : 'marca';
    default: return tipo;
  }
}
