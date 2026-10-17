import { FormGroup } from '@angular/forms';
import type { OpcaoSelecao } from './campos';

export type VarianteAviso = 'error' | 'success' | 'info';

/**
 * O que toda função dinâmica e todo gancho do formulário recebe.
 *
 * As leituras (`valores`, `opcao`, `opcoes`) são reativas: uma opção
 * `rotulo: ctx => ...` é recalculada sempre que algo que ela leu muda.
 *
 * Nos campos, `valores` vem como `Record<string, any>` — os campos são
 * declarados antes de o formulário existir, então não há de onde tirar o
 * tipo. Nos ganchos do formulário (`aoConfirmar`, `aoConcluir`...), `V` é o
 * valor inferido dos campos.
 */
export interface ContextoFormulario<V = Record<string, any>> {
  /** Valores atuais de todos os campos, inclusive escondidos e desabilitados. */
  readonly valores: V;

  /** A opção escolhida num campo de seleção — com `dados`, o registro por trás dela. */
  opcao(chave: keyof V & string): OpcaoSelecao<any> | undefined;

  /** As opções disponíveis agora num campo de seleção. */
  opcoes(chave: keyof V & string): readonly OpcaoSelecao<any>[];

  /** Muda o valor de um campo, como se o usuário tivesse mudado. */
  definir<K extends keyof V & string>(chave: K, valor: V[K]): void;

  /** Muda vários campos de uma vez — ex.: carregar um registro escolhido. */
  preencher(valores: Partial<V>): void;

  /**
   * Volta ao estado de quando abriu (valores iniciais, nada tocado, sem
   * erros), sobrescrevendo o que vier em `valores`.
   */
  redefinir(valores?: Partial<V>): void;

  /** Mostra um aviso no topo do formulário; some sozinho se houver `duracaoMs`. */
  avisar(texto: string, variante?: VarianteAviso, duracaoMs?: number): void;

  /** O FormGroup por baixo, para o que as opções não cobrirem. */
  readonly form: FormGroup;
}

/**
 * Erro de envio com detalhe por campo. Lançado (ou emitido) dentro de
 * `aoConfirmar`, mostra `message` no aviso do topo e cada mensagem de
 * `campos` embaixo do campo correspondente, até que ele seja alterado.
 *
 *   return throwError(() => new ErroFormulario(
 *     'Limpar campos ainda não é suportado.',
 *     { telefone: 'Não é possível limpar este campo no momento.' },
 *     'aviso',
 *   ));
 */
export class ErroFormulario extends Error {
  constructor(
    mensagem: string,
    readonly campos: Record<string, string> = {},
    /** `aviso` pinta os campos de âmbar em vez de vermelho. */
    readonly tom: 'erro' | 'aviso' = 'erro',
  ) {
    super(mensagem);
    this.name = 'ErroFormulario';
  }
}
