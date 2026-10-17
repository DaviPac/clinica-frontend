import { TemplateRef } from '@angular/core';
import { Observable } from 'rxjs';

export type TipoMensagem = 'info' | 'sucesso' | 'aviso' | 'erro' | 'confirmar';

/** Cor do botão de confirmação e do ícone — igual à do antigo `<app-confirm-dialog>`. */
export type VarianteConfirmacao = 'primario' | 'perigo' | 'sucesso';

export interface OpcoesConfirmacao {
  mensagem: string;
  titulo?: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  /** Rótulo do botão enquanto `aoConfirmar` roda. */
  rotuloProcessando?: string;
  variante?: VarianteConfirmacao;
  /**
   * Conteúdo extra entre o texto e os botões — valores em destaque, avisos.
   * Um <ng-template> da tela que chama, como o `<ng-content>` do antigo
   * `<app-confirm-dialog>`.
   */
  conteudo?: TemplateRef<unknown>;
  /**
   * Ação executada ao confirmar, com o diálogo ainda aberto: os botões ficam
   * travados até ela completar. Se der erro, a mensagem aparece no próprio
   * diálogo e o usuário pode tentar de novo ou cancelar.
   */
  aoConfirmar?: () => Observable<unknown>;
}

export interface DadosMensagem extends Partial<OpcoesConfirmacao> {
  tipo: TipoMensagem;
  mensagem: string;
}
