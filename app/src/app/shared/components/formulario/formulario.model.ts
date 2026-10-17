import { Observable } from 'rxjs';
import { TamanhoDialogo } from '../../../core/services/dialogo/dialogo.service';
import { TamanhoBotao } from '../../ui/botao/botao.component';
import { OpcoesConfirmacao } from '../mensagem/mensagem.model';
import { ItemFormulario, ValorFormulario } from './campos';
import { ContextoFormulario } from './contexto';

export interface BotoesFormulario {
  /** Padrão: 'Salvar'. */
  confirmar?: string;
  /** Rótulo enquanto `aoConfirmar` roda. Padrão: 'Salvando...'. */
  processando?: string;
  /** Padrão: 'Cancelar'. `null` esconde o botão. */
  cancelar?: string | null;
  tamanho?: TamanhoBotao;
  /**
   * `dividida`: os botões dividem a linha (padrão);
   * `direita`: alinhados à direita, do tamanho do texto;
   * `largura-total`: um embaixo do outro, ocupando a linha.
   */
  disposicao?: 'dividida' | 'direita' | 'largura-total';
}

/**
 * Tudo que descreve um formulário — o mesmo objeto serve para o
 * `<app-formulario>` dentro de uma página e para o `FormularioService.abrir`.
 * Monte com `definirFormulario({...})` para o `valor` vir tipado.
 */
export interface DefinicaoFormulario<C extends readonly ItemFormulario[] = readonly ItemFormulario[], R = unknown> {
  campos: C;
  /** Valores iniciais — ex.: o registro em edição. O que faltar usa o `valorInicial` do campo. */
  valores?: Partial<ValorFormulario<C>>;
  /** Texto curto acima dos campos. */
  descricao?: string;

  /**
   * Validação que envolve mais de um campo. Devolve a mensagem por chave
   * do campo onde o erro deve aparecer, ou `null`.
   *
   *   validar: v => v.nova !== v.confirmar ? { confirmar: 'As senhas não coincidem.' } : null
   */
  validar?: (valores: ValorFormulario<C>) => Record<string, string> | null;

  /**
   * `ao-enviar` (padrão): o botão fica sempre ativo e, se faltar algo,
   * marca os campos com erro. `bloquear`: o botão só ativa quando tudo
   * estiver válido.
   */
  modoValidacao?: 'ao-enviar' | 'bloquear';

  /** Onde aparecem os avisos de erro/sucesso. Padrão: 'topo'. */
  posicaoAvisos?: 'topo' | 'rodape';

  /** `false` esconde os botões — para formulários controlados de fora. */
  botoes?: BotoesFormulario | false;

  /** Roda uma vez, logo depois que o formulário monta. */
  aoIniciar?: (ctx: ContextoFormulario<ValorFormulario<C>>) => void | Observable<unknown>;

  /**
   * Pede confirmação (pelo MensagemService) antes de enviar. `aoConfirmar`
   * roda com o diálogo de confirmação aberto, que fecha ao terminar — com
   * sucesso ou erro; o erro aparece no formulário.
   */
  confirmacao?: (valor: ValorFormulario<C>, ctx: ContextoFormulario<ValorFormulario<C>>) => Omit<OpcoesConfirmacao, 'aoConfirmar'>;

  /**
   * Executada ao enviar um formulário válido, com os botões travados. Se
   * completar, o envio deu certo; se der erro, a mensagem aparece no aviso
   * — lance um `ErroFormulario` para marcar campos específicos.
   */
  aoConfirmar?: (valor: ValorFormulario<C>, ctx: ContextoFormulario<ValorFormulario<C>>) => Observable<R>;

  /**
   * Depois de um envio bem-sucedido. Num diálogo, ele já fechou; numa
   * página, é aqui que se limpa o formulário (`ctx.redefinir()`) ou se
   * avisa o sucesso (`ctx.avisar(...)`).
   */
  aoConcluir?: (resposta: R | undefined, ctx: ContextoFormulario<ValorFormulario<C>>) => void;
}

/** A definição + o que só faz sentido num diálogo. */
export interface OpcoesFormulario<C extends readonly ItemFormulario[], R> extends DefinicaoFormulario<C, R> {
  titulo: string;
  tamanho?: TamanhoDialogo;
}

/** O que um envio bem-sucedido entrega. */
export interface ResultadoFormulario<V, R> {
  valor: V;
  /** Último valor emitido por `aoConfirmar` — ex.: o registro criado. */
  resposta: R | undefined;
}

/** Só existe para inferir os tipos: devolve a própria definição. */
export function definirFormulario<const C extends readonly ItemFormulario[], R = unknown>(
  definicao: DefinicaoFormulario<C, R>,
): DefinicaoFormulario<C, R> {
  return definicao;
}
