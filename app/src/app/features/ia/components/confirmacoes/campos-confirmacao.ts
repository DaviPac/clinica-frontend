/**
 * Descrição dos campos de cada ferramenta de escrita.
 *
 * É daqui que o formulário de confirmação genérico tira rótulos em português,
 * tipos de input e selects de entidade. Um descritor por ferramenta evita
 * catorze componentes quase idênticos, e ainda garante que o usuário possa
 * TROCAR o paciente, o serviço ou o status que a IA sugeriu — não apenas
 * aprovar um ID cru.
 *
 * `criar_agendamento` não está aqui: tem componente próprio, porque as regras de
 * pacote e recorrência precisam reagir umas às outras.
 */

export type TipoCampo =
  | 'texto'
  | 'textarea'
  | 'senha'
  | 'numero'
  | 'moeda'
  | 'data'
  | 'datahora'
  | 'mes'
  | 'booleano'
  | 'enum'
  | 'entidade';

export type Entidade = 'paciente' | 'servico' | 'profissional' | 'agendamento' | 'despesa';

/**
 * Cada metadado abaixo espelha um Validators da tela correspondente. Quando um
 * campo tem `min`/`minLength`/`email` aqui, é porque o formulário da tela tem o
 * mesmo — não porque pareceu razoável.
 */
export interface CampoConfirmacao {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  /** A tela só exige este campo quando o usuário é admin (ex.: profissional). */
  obrigatorioSeAdmin?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
  entidade?: Entidade;
  ajuda?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  /** Valor inicial quando a IA não informou nada (espelha o default da tela). */
  padrao?: unknown;
  /** Campo só aparece quando este outro campo está preenchido. */
  dependeDe?: string;
  /** Só admin vê/edita. */
  somenteAdmin?: boolean;
  /**
   * Ao escolher a entidade neste campo, carrega os valores atuais do registro
   * nos demais campos — como as telas de edição, que abrem pré-preenchidas.
   * O que a IA propôs tem precedência sobre o valor atual.
   */
  preencherDemais?: Entidade;
  /** Só oferece agendamentos que fazem parte de uma série. */
  somenteRecorrentes?: boolean;
  /** Filtra as opções do enum pelo registro escolhido em `dependeDeEntidade`. */
  opcoesConformeStatusDe?: string;
}

const STATUS_AGENDAMENTO = [
  { valor: 'AGENDADO', rotulo: 'Agendado' },
  { valor: 'REALIZADO', rotulo: 'Realizado' },
  { valor: 'FALTA', rotulo: 'Falta' },
  { valor: 'CANCELADO', rotulo: 'Cancelado' },
];

const PAPEIS = [
  { valor: 'PROFISSIONAL', rotulo: 'Profissional' },
  { valor: 'ADMIN', rotulo: 'Administrador' },
];

const CATEGORIAS_DESPESA = [
  { valor: 'FIXA', rotulo: 'Fixa' },
  { valor: 'VARIAVEL', rotulo: 'Variável' },
];

export const CAMPOS_POR_FERRAMENTA: Record<string, CampoConfirmacao[]> = {
  atualizar_status_agendamento: [
    { nome: 'agendamento_id', rotulo: 'Agendamento', tipo: 'entidade', entidade: 'agendamento', obrigatorio: true },
    {
      nome: 'status',
      rotulo: 'Novo status',
      tipo: 'enum',
      opcoes: STATUS_AGENDAMENTO,
      obrigatorio: true,
      // A tela só oferece as transições válidas; aqui é o mesmo mapa.
      opcoesConformeStatusDe: 'agendamento_id',
    },
  ],

  atualizar_pagamento_agendamento: [
    { nome: 'agendamento_id', rotulo: 'Agendamento', tipo: 'entidade', entidade: 'agendamento', obrigatorio: true },
    { nome: 'pago', rotulo: 'Pago pelo paciente', tipo: 'booleano' },
  ],

  atualizar_valor_agendamento: [
    { nome: 'agendamento_id', rotulo: 'Agendamento', tipo: 'entidade', entidade: 'agendamento', obrigatorio: true },
    { nome: 'valor_combinado', rotulo: 'Novo valor', tipo: 'moeda', obrigatorio: true, min: 0 },
    {
      nome: 'recorrente',
      rotulo: 'Aplicar a toda a série',
      tipo: 'booleano',
      ajuda: 'Altera o valor de todas as sessões da recorrência.',
    },
  ],

  reagendar_agendamento: [
    { nome: 'agendamento_id', rotulo: 'Agendamento', tipo: 'entidade', entidade: 'agendamento', obrigatorio: true },
    { nome: 'novo_inicio', rotulo: 'Nova data e hora', tipo: 'datahora', obrigatorio: true },
    { nome: 'duracao_minutos', rotulo: 'Duração (minutos)', tipo: 'numero', obrigatorio: true, min: 1 },
    { nome: 'reagendar_recorrencia', rotulo: 'Reagendar a série inteira', tipo: 'booleano' },
    {
      nome: 'intervalo_semanas',
      rotulo: 'Intervalo entre sessões (semanas)',
      tipo: 'numero',
      dependeDe: 'reagendar_recorrencia',
      obrigatorio: true,
      min: 1,
      padrao: 1,
    },
  ],

  cancelar_recorrencia: [
    {
      nome: 'agendamento_id',
      rotulo: 'Série recorrente',
      tipo: 'entidade',
      entidade: 'agendamento',
      obrigatorio: true,
      somenteRecorrentes: true,
      ajuda: 'Todos os agendamentos futuros desta série serão cancelados.',
    },
  ],

  criar_paciente: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, minLength: 3 },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'texto' },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
    { nome: 'dataNascimento', rotulo: 'Data de nascimento', tipo: 'data' },
    { nome: 'rg', rotulo: 'RG', tipo: 'texto' },
    { nome: 'enderecoCompleto', rotulo: 'Endereço', tipo: 'texto' },
    {
      nome: 'profissional_id',
      rotulo: 'Profissional',
      tipo: 'entidade',
      entidade: 'profissional',
      somenteAdmin: true,
      obrigatorioSeAdmin: true,
    },
  ],

  atualizar_paciente: [
    {
      nome: 'paciente_id',
      rotulo: 'Paciente',
      tipo: 'entidade',
      entidade: 'paciente',
      obrigatorio: true,
      preencherDemais: 'paciente',
    },
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, minLength: 3 },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'texto' },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
    { nome: 'dataNascimento', rotulo: 'Data de nascimento', tipo: 'data' },
    { nome: 'rg', rotulo: 'RG', tipo: 'texto' },
    { nome: 'enderecoCompleto', rotulo: 'Endereço', tipo: 'texto' },
  ],

  inativar_paciente: [
    { nome: 'paciente_id', rotulo: 'Paciente', tipo: 'entidade', entidade: 'paciente', obrigatorio: true },
  ],

  ativar_paciente: [
    { nome: 'paciente_id', rotulo: 'Paciente', tipo: 'entidade', entidade: 'paciente', obrigatorio: true },
  ],

  criar_servico: [
    { nome: 'nome', rotulo: 'Nome do serviço', tipo: 'texto', obrigatorio: true },
    { nome: 'valor_atual', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true, min: 0.01 },
    { nome: 'pacote', rotulo: 'É um pacote fechado', tipo: 'booleano', ajuda: 'Pacotes geram séries recorrentes e o valor é o total.' },
    { nome: 'profissional_id', rotulo: 'Profissional', tipo: 'entidade', entidade: 'profissional', somenteAdmin: true },
  ],

  atualizar_servico: [
    {
      nome: 'servico_id',
      rotulo: 'Serviço',
      tipo: 'entidade',
      entidade: 'servico',
      obrigatorio: true,
      preencherDemais: 'servico',
    },
    { nome: 'nome', rotulo: 'Nome do serviço', tipo: 'texto', obrigatorio: true },
    { nome: 'valor_atual', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true, min: 0.01 },
    { nome: 'pacote', rotulo: 'É um pacote fechado', tipo: 'booleano' },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' },
  ],

  desativar_servico: [
    { nome: 'servico_id', rotulo: 'Serviço', tipo: 'entidade', entidade: 'servico', obrigatorio: true },
  ],

  criar_despesa: [
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true },
    { nome: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true, min: 0.01 },
    { nome: 'data_vencimento', rotulo: 'Vencimento', tipo: 'data', obrigatorio: true },
    {
      nome: 'categoria',
      rotulo: 'Categoria',
      tipo: 'enum',
      opcoes: CATEGORIAS_DESPESA,
      obrigatorio: true,
      padrao: 'FIXA',
    },
  ],

  pagar_despesa: [
    { nome: 'despesa_id', rotulo: 'Despesa', tipo: 'entidade', entidade: 'despesa', obrigatorio: true },
  ],

  criar_acerto: [
    { nome: 'profissional_id', rotulo: 'Profissional', tipo: 'entidade', entidade: 'profissional', obrigatorio: true },
    {
      nome: 'periodo_referencia',
      rotulo: 'Período de referência',
      tipo: 'mes',
      obrigatorio: true,
      padrao: mesCorrente(),
    },
    { nome: 'valor_pago', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true, min: 0.01 },
    {
      nome: 'profissional_recebe',
      rotulo: 'A clínica paga o profissional',
      tipo: 'booleano',
      padrao: true,
      ajuda: 'Desmarque se for o profissional repassando à clínica.',
    },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
  ],

  criar_usuario: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true },
    { nome: 'email', rotulo: 'E-mail', tipo: 'texto', obrigatorio: true, email: true },
    {
      nome: 'senha',
      rotulo: 'Senha inicial',
      tipo: 'senha',
      obrigatorio: true,
      minLength: 6,
      ajuda: 'Mínimo de 6 caracteres. A IA não vê nem sugere senhas — defina você.',
    },
    { nome: 'role', rotulo: 'Papel', tipo: 'enum', opcoes: PAPEIS, obrigatorio: true, padrao: 'PROFISSIONAL' },
    { nome: 'profissao', rotulo: 'Profissão', tipo: 'texto' },
    {
      nome: 'taxaComissaoPadrao',
      rotulo: 'Comissão da clínica (%)',
      tipo: 'numero',
      obrigatorio: true,
      min: 0,
      max: 100,
      padrao: 40,
    },
  ],

  atualizar_usuario: [
    {
      nome: 'usuario_id',
      rotulo: 'Usuário',
      tipo: 'entidade',
      entidade: 'profissional',
      obrigatorio: true,
      preencherDemais: 'profissional',
    },
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, maxLength: 120 },
    { nome: 'email', rotulo: 'E-mail', tipo: 'texto', obrigatorio: true, email: true },
    { nome: 'role', rotulo: 'Papel', tipo: 'enum', opcoes: PAPEIS, obrigatorio: true },
    { nome: 'profissao', rotulo: 'Profissão', tipo: 'texto' },
    {
      nome: 'taxaComissaoPadrao',
      rotulo: 'Comissão da clínica (%)',
      tipo: 'numero',
      obrigatorio: true,
      min: 0,
      max: 100,
    },
    { nome: 'profissionalRecebe', rotulo: 'A clínica repassa ao profissional', tipo: 'booleano' },
  ],
};

/** Mês corrente no formato YYYY-MM — o mesmo default das telas financeiras. */
function mesCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Fallback: deriva campos de texto a partir das chaves recebidas. */
export function camposDerivados(args: Record<string, unknown>): CampoConfirmacao[] {
  return Object.keys(args).map((nome) => ({
    nome,
    rotulo: nome.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    tipo: typeof args[nome] === 'boolean' ? 'booleano' : typeof args[nome] === 'number' ? 'numero' : 'texto',
  }));
}
