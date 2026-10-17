import { ValidatorFn, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import type { ContextoFormulario } from './contexto';

/**
 * Definição declarativa dos itens de um formulário, no estilo das colunas
 * do VsGrid: cada tipo é uma classe, instanciada com suas opções.
 *
 *   campos: [
 *     new CampoTexto({ chave: 'nome', rotulo: 'Nome', obrigatorio: true }),
 *     new CampoNumero({ chave: 'valor', rotulo: 'Valor (R$)', minimo: 0.01, largura: 'metade' }),
 *   ]
 *
 * A `chave` vira o nome da propriedade no valor final, e o tipo de cada
 * propriedade sai da classe — `ValorFormulario<typeof campos>` dá
 * `{ nome: string; valor: number | null }`.
 *
 * Quase toda opção aceita um valor fixo ou uma função do estado atual do
 * formulário (`Dinamico<T>`), reavaliada a cada mudança:
 *
 *   rotulo: ctx => ctx.valores.pacote ? 'Valor total do pacote' : 'Valor por sessão',
 *   visivel: ctx => ctx.valores.recorrente,
 *   desabilitado: ctx => !!ctx.opcao('servico_id')?.dados?.is_pacote,
 */

/** Um valor fixo ou calculado a partir do estado do formulário. */
export type Dinamico<T> = T | ((ctx: ContextoFormulario) => T);

export function resolver<T>(valor: Dinamico<T>, ctx: ContextoFormulario): T {
  return typeof valor === 'function' ? (valor as (ctx: ContextoFormulario) => T)(ctx) : valor;
}

/** `metade` divide a linha com o item vizinho a partir de 640px. */
export type LarguraItem = 'inteira' | 'metade';

export interface OpcoesItem {
  /** Padrão: true. Item escondido não é validado, mas o valor continua no resultado. */
  visivel?: Dinamico<boolean>;
  largura?: LarguraItem;
}

/** Tudo que pode aparecer na lista `campos`: campos com valor, notas e seções. */
export abstract class ItemFormulario {
  abstract readonly tipo: string;
  readonly visivel: Dinamico<boolean>;
  readonly largura: LarguraItem;

  constructor(o: OpcoesItem) {
    this.visivel = o.visivel ?? true;
    this.largura = o.largura ?? 'inteira';
  }
}

// ── Itens sem valor ──────────────────────────────────────────────────

export interface OpcoesNota extends OpcoesItem {
  texto: Dinamico<string>;
}

/** Linha de texto entre os campos: "Horário atual: ...", prévias calculadas etc. */
export class Nota extends ItemFormulario {
  readonly tipo = 'nota';
  readonly texto: Dinamico<string>;

  constructor(o: OpcoesNota) {
    super(o);
    this.texto = o.texto;
  }
}

export interface OpcoesSecao extends OpcoesItem {
  titulo: Dinamico<string>;
}

/** Título que separa um grupo de campos. */
export class Secao extends ItemFormulario {
  readonly tipo = 'secao';
  readonly titulo: Dinamico<string>;

  constructor(o: OpcoesSecao) {
    super(o);
    this.titulo = o.titulo;
  }
}

// ── Campos ───────────────────────────────────────────────────────────

export interface OpcoesCampo<K extends string, V> extends OpcoesItem {
  chave: K;
  rotulo: Dinamico<string>;
  obrigatorio?: Dinamico<boolean>;
  /** Texto de apoio abaixo do controle, quando não há erro. */
  ajuda?: Dinamico<string>;
  placeholder?: Dinamico<string>;
  desabilitado?: Dinamico<boolean>;
  /** Valor quando o formulário abre sem um valor para esta chave em `valores`. */
  valorInicial?: V;
  /** Validadores extras, além dos que as opções do campo já criam. */
  validadores?: ValidatorFn[];
  /** Mensagem por chave de erro: `{ required: 'Informe o nome' }`. */
  mensagens?: Record<string, string>;
  /**
   * Chamada sempre que o valor deste campo muda — pelo usuário ou por
   * `ctx.definir`. Serve para preencher ou travar outros campos. Se devolver
   * um Observable, ele é assinado; uma nova mudança cancela o anterior.
   */
  aoMudar?: (valor: V, ctx: ContextoFormulario) => void | Observable<unknown>;
}

export abstract class Campo<K extends string = string, V = unknown> extends ItemFormulario {
  /** Só existe no tipo: é daqui que `ValorFormulario` tira o valor do campo. */
  declare readonly _valor: V;

  readonly chave: K;
  readonly rotulo: Dinamico<string>;
  readonly obrigatorio: Dinamico<boolean>;
  readonly ajuda: Dinamico<string>;
  readonly placeholder: Dinamico<string>;
  readonly desabilitado: Dinamico<boolean>;
  readonly valorInicial?: V;
  readonly mensagens: Record<string, string>;
  readonly aoMudar?: (valor: V, ctx: ContextoFormulario) => void | Observable<unknown>;
  private readonly extras: ValidatorFn[];

  constructor(o: OpcoesCampo<K, V>) {
    super(o);
    this.chave = o.chave;
    this.rotulo = o.rotulo;
    this.obrigatorio = o.obrigatorio ?? false;
    this.ajuda = o.ajuda ?? '';
    this.placeholder = o.placeholder ?? '';
    this.desabilitado = o.desabilitado ?? false;
    this.valorInicial = o.valorInicial;
    this.mensagens = o.mensagens ?? {};
    this.aoMudar = o.aoMudar;
    this.extras = o.validadores ?? [];
  }

  /** Valor quando não há nem `valores[chave]` nem `valorInicial`. */
  abstract valorVazio(): V;

  /**
   * Validadores fixos do tipo + os extras. `obrigatorio`, `minimo` e
   * `maximo` podem ser dinâmicos, então quem os aplica é o formulário.
   */
  validadores(): ValidatorFn[] {
    return [...this.validadoresDoTipo(), ...this.extras];
  }

  protected validadoresDoTipo(): ValidatorFn[] {
    return [];
  }
}

// ── Texto ────────────────────────────────────────────────────────────

export interface OpcoesCampoTexto<K extends string> extends OpcoesCampo<K, string> {
  /** Tipo do <input>: muda o teclado no mobile e, em `email`, valida o formato. */
  formato?: 'text' | 'email' | 'tel' | 'password' | 'search';
  /** Em `password`, mostra o botão de olho para exibir a senha. */
  alternarVisibilidade?: boolean;
  /** `inputmode` do input — `numeric` para CPF, por exemplo. */
  modoEntrada?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  autocompletar?: string;
  minimoCaracteres?: number;
  maximoCaracteres?: number;
  padrao?: RegExp | string;
  mono?: boolean;
}

export class CampoTexto<K extends string> extends Campo<K, string> {
  readonly tipo = 'texto';
  readonly formato: NonNullable<OpcoesCampoTexto<K>['formato']>;
  readonly alternarVisibilidade: boolean;
  readonly modoEntrada?: OpcoesCampoTexto<K>['modoEntrada'];
  readonly autocompletar?: string;
  readonly minimoCaracteres?: number;
  readonly maximoCaracteres?: number;
  readonly padrao?: RegExp | string;
  readonly mono: boolean;

  constructor(o: OpcoesCampoTexto<K>) {
    super(o);
    this.formato = o.formato ?? 'text';
    this.alternarVisibilidade = o.alternarVisibilidade ?? false;
    this.modoEntrada = o.modoEntrada;
    this.autocompletar = o.autocompletar;
    this.minimoCaracteres = o.minimoCaracteres;
    this.maximoCaracteres = o.maximoCaracteres;
    this.padrao = o.padrao;
    this.mono = o.mono ?? false;
  }

  valorVazio() { return ''; }

  protected override validadoresDoTipo(): ValidatorFn[] {
    return [
      ...(this.formato === 'email' ? [Validators.email] : []),
      ...(this.minimoCaracteres != null ? [Validators.minLength(this.minimoCaracteres)] : []),
      ...(this.maximoCaracteres != null ? [Validators.maxLength(this.maximoCaracteres)] : []),
      ...(this.padrao != null ? [Validators.pattern(this.padrao)] : []),
    ];
  }
}

// ── Área de texto ────────────────────────────────────────────────────

export interface OpcoesCampoAreaTexto<K extends string> extends OpcoesCampo<K, string> {
  linhas?: number;
  maximoCaracteres?: number;
}

export class CampoAreaTexto<K extends string> extends Campo<K, string> {
  readonly tipo = 'area-texto';
  readonly linhas: number;
  readonly maximoCaracteres?: number;

  constructor(o: OpcoesCampoAreaTexto<K>) {
    super(o);
    this.linhas = o.linhas ?? 3;
    this.maximoCaracteres = o.maximoCaracteres;
  }

  valorVazio() { return ''; }

  protected override validadoresDoTipo(): ValidatorFn[] {
    return this.maximoCaracteres != null ? [Validators.maxLength(this.maximoCaracteres)] : [];
  }
}

// ── Número ───────────────────────────────────────────────────────────

export interface OpcoesCampoNumero<K extends string> extends OpcoesCampo<K, number | null> {
  minimo?: Dinamico<number | undefined>;
  maximo?: Dinamico<number | undefined>;
  /** Incremento do <input type="number">. Padrão: 1; use 0.01 para valores em reais. */
  passo?: number;
  /** Padrão: true — números alinham melhor em fonte monoespaçada. */
  mono?: boolean;
}

export class CampoNumero<K extends string> extends Campo<K, number | null> {
  readonly tipo = 'numero';
  readonly minimo: Dinamico<number | undefined>;
  readonly maximo: Dinamico<number | undefined>;
  readonly passo: number;
  readonly mono: boolean;

  constructor(o: OpcoesCampoNumero<K>) {
    super(o);
    this.minimo = o.minimo;
    this.maximo = o.maximo;
    this.passo = o.passo ?? 1;
    this.mono = o.mono ?? true;
  }

  valorVazio() { return null; }
}

// ── Data ─────────────────────────────────────────────────────────────

export interface OpcoesCampoData<K extends string> extends OpcoesCampo<K, string> {
  /** `data` → yyyy-mm-dd, `datahora` → yyyy-mm-ddThh:mm, `mes` → yyyy-mm. */
  formato?: 'data' | 'datahora' | 'mes';
  /** Limites no mesmo formato do valor. */
  minimo?: Dinamico<string | undefined>;
  maximo?: Dinamico<string | undefined>;
}

/** O valor é a string do input, no formato escolhido. */
export class CampoData<K extends string> extends Campo<K, string> {
  readonly tipo = 'data';
  readonly formato: 'data' | 'datahora' | 'mes';
  readonly minimo: Dinamico<string | undefined>;
  readonly maximo: Dinamico<string | undefined>;

  constructor(o: OpcoesCampoData<K>) {
    super(o);
    this.formato = o.formato ?? 'data';
    this.minimo = o.minimo;
    this.maximo = o.maximo;
  }

  get tipoInput() {
    return this.formato === 'datahora' ? 'datetime-local' : this.formato === 'mes' ? 'month' : 'date';
  }

  valorVazio() { return ''; }
}

// ── Seleção ──────────────────────────────────────────────────────────

export interface OpcaoSelecao<V> {
  valor: V;
  rotulo: string;
  /** Linha de explicação — aparece na apresentação `radio`. */
  descricao?: string;
  desabilitada?: boolean;
  /**
   * O registro por trás da opção (o serviço, o paciente...). Fica acessível
   * em `ctx.opcao(chave)?.dados` para os outros campos reagirem à escolha.
   */
  dados?: any;
}

export interface OpcoesCampoSelecao<K extends string, V> extends OpcoesCampo<K, V> {
  /** Lista fixa ou calculada a partir do estado do formulário. */
  opcoes?: Dinamico<readonly OpcaoSelecao<V>[]>;
  /**
   * Lista vinda da API. É carregada ao abrir e de novo sempre que um dos
   * campos de `recarregarQuando` muda — não a cada tecla.
   */
  carregarOpcoes?: (ctx: ContextoFormulario) => Observable<readonly OpcaoSelecao<V>[]>;
  recarregarQuando?: readonly string[];
  /** `lista` é um <select>; `radio` mostra as opções como cartões com descrição. */
  apresentacao?: 'lista' | 'radio';
  /** Deixa o placeholder escolhível (volta o valor para `null`). Padrão: false. */
  placeholderSelecionavel?: boolean;
}

/**
 * O valor é o `valor` da opção escolhida, com o tipo preservado — não
 * precisa ser string. Sem valor inicial, começa na primeira opção; com
 * `placeholder`, começa vazio (`null`) e mostra o placeholder.
 */
export class CampoSelecao<K extends string, const V> extends Campo<K, V> {
  readonly tipo = 'selecao';
  readonly opcoes: Dinamico<readonly OpcaoSelecao<V>[]>;
  readonly carregarOpcoes?: (ctx: ContextoFormulario) => Observable<readonly OpcaoSelecao<V>[]>;
  readonly recarregarQuando: readonly string[];
  readonly apresentacao: 'lista' | 'radio';
  readonly placeholderSelecionavel: boolean;

  constructor(o: OpcoesCampoSelecao<K, V>) {
    super(o);
    this.opcoes = o.opcoes ?? [];
    this.carregarOpcoes = o.carregarOpcoes;
    this.recarregarQuando = o.recarregarQuando ?? [];
    this.apresentacao = o.apresentacao ?? 'lista';
    this.placeholderSelecionavel = o.placeholderSelecionavel ?? false;
  }

  /** O formulário troca pela primeira opção, se não houver placeholder. */
  valorVazio(): V {
    return null as V;
  }
}

// ── Alternador ───────────────────────────────────────────────────────

export interface OpcoesCampoAlternador<K extends string> extends OpcoesCampo<K, boolean> {
  /** Linha de explicação junto ao rótulo. */
  descricao?: Dinamico<string>;
  /**
   * `cartao`: interruptor numa caixa com rótulo e descrição;
   * `simples`: interruptor com o rótulo ao lado;
   * `caixa`: caixa de marcação (checkbox).
   */
  apresentacao?: 'cartao' | 'simples' | 'caixa';
}

export class CampoAlternador<K extends string> extends Campo<K, boolean> {
  readonly tipo = 'alternador';
  readonly descricao: Dinamico<string>;
  readonly apresentacao: 'cartao' | 'simples' | 'caixa';

  constructor(o: OpcoesCampoAlternador<K>) {
    super(o);
    this.descricao = o.descricao ?? '';
    this.apresentacao = o.apresentacao ?? 'cartao';
  }

  valorVazio() { return false; }
}

// ── Tipos derivados ──────────────────────────────────────────────────

export type CampoFormulario =
  | CampoTexto<string>
  | CampoAreaTexto<string>
  | CampoNumero<string>
  | CampoData<string>
  | CampoSelecao<string, unknown>
  | CampoAlternador<string>;

export type ItemQualquer = CampoFormulario | Nota | Secao;

/** O objeto que o formulário entrega: uma propriedade por campo (notas e seções ficam de fora). */
export type ValorFormulario<C extends readonly ItemFormulario[]> = {
  [E in Extract<C[number], Campo<string, any>> as E['chave']]: E['_valor'];
};
