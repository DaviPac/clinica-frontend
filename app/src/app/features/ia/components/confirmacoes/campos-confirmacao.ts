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

export interface CampoConfirmacao {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
  entidade?: Entidade;
  ajuda?: string;
  /** Campo só aparece quando este outro campo está preenchido. */
  dependeDe?: string;
  /** Só admin vê/edita. */
  somenteAdmin?: boolean;
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
    { nome: 'status', rotulo: 'Novo status', tipo: 'enum', opcoes: STATUS_AGENDAMENTO, obrigatorio: true },
  ],

  atualizar_pagamento_agendamento: [
    { nome: 'agendamento_id', rotulo: 'Agendamento', tipo: 'entidade', entidade: 'agendamento', obrigatorio: true },
    { nome: 'pago', rotulo: 'Pago pelo paciente', tipo: 'booleano' },
  ],

  atualizar_valor_agendamento: [
    { nome: 'agendamento_id', rotulo: 'Agendamento', tipo: 'entidade', entidade: 'agendamento', obrigatorio: true },
    { nome: 'valor_combinado', rotulo: 'Novo valor', tipo: 'moeda', obrigatorio: true },
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
    { nome: 'duracao_minutos', rotulo: 'Duração (minutos)', tipo: 'numero', obrigatorio: true },
    { nome: 'reagendar_recorrencia', rotulo: 'Reagendar a série inteira', tipo: 'booleano' },
    { nome: 'intervalo_semanas', rotulo: 'Intervalo entre sessões (semanas)', tipo: 'numero', dependeDe: 'reagendar_recorrencia' },
  ],

  cancelar_recorrencia: [
    {
      nome: 'group_id',
      rotulo: 'ID do grupo de recorrência',
      tipo: 'texto',
      obrigatorio: true,
      ajuda: 'Todos os agendamentos futuros desta série serão cancelados.',
    },
  ],

  criar_paciente: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'texto', obrigatorio: true },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
    { nome: 'dataNascimento', rotulo: 'Data de nascimento', tipo: 'data' },
    { nome: 'rg', rotulo: 'RG', tipo: 'texto' },
    { nome: 'enderecoCompleto', rotulo: 'Endereço', tipo: 'texto' },
    { nome: 'profissional_id', rotulo: 'Profissional', tipo: 'entidade', entidade: 'profissional', somenteAdmin: true },
  ],

  atualizar_paciente: [
    { nome: 'paciente_id', rotulo: 'Paciente', tipo: 'entidade', entidade: 'paciente', obrigatorio: true },
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto' },
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
    { nome: 'valor_atual', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
    { nome: 'pacote', rotulo: 'É um pacote fechado', tipo: 'booleano', ajuda: 'Pacotes geram séries recorrentes e o valor é o total.' },
    { nome: 'profissional_id', rotulo: 'Profissional', tipo: 'entidade', entidade: 'profissional', somenteAdmin: true },
  ],

  atualizar_servico: [
    { nome: 'servico_id', rotulo: 'Serviço', tipo: 'entidade', entidade: 'servico', obrigatorio: true },
    { nome: 'nome', rotulo: 'Nome do serviço', tipo: 'texto' },
    { nome: 'valor_atual', rotulo: 'Valor', tipo: 'moeda' },
    { nome: 'pacote', rotulo: 'É um pacote fechado', tipo: 'booleano' },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' },
  ],

  desativar_servico: [
    { nome: 'servico_id', rotulo: 'Serviço', tipo: 'entidade', entidade: 'servico', obrigatorio: true },
  ],

  criar_despesa: [
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true },
    { nome: 'valor', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
    { nome: 'data_vencimento', rotulo: 'Vencimento', tipo: 'data', obrigatorio: true },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'enum', opcoes: CATEGORIAS_DESPESA, obrigatorio: true },
  ],

  pagar_despesa: [
    { nome: 'despesa_id', rotulo: 'Despesa', tipo: 'entidade', entidade: 'despesa', obrigatorio: true },
  ],

  criar_acerto: [
    { nome: 'profissional_id', rotulo: 'Profissional', tipo: 'entidade', entidade: 'profissional', obrigatorio: true },
    { nome: 'periodo_referencia', rotulo: 'Período de referência', tipo: 'mes', obrigatorio: true },
    { nome: 'valor_pago', rotulo: 'Valor', tipo: 'moeda', obrigatorio: true },
    {
      nome: 'profissional_recebe',
      rotulo: 'A clínica paga o profissional',
      tipo: 'booleano',
      ajuda: 'Desmarque se for o profissional repassando à clínica.',
    },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
  ],

  criar_usuario: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true },
    { nome: 'email', rotulo: 'E-mail', tipo: 'texto', obrigatorio: true },
    {
      nome: 'senha',
      rotulo: 'Senha inicial',
      tipo: 'senha',
      obrigatorio: true,
      ajuda: 'Mínimo de 6 caracteres. A IA não vê nem sugere senhas — defina você.',
    },
    { nome: 'role', rotulo: 'Papel', tipo: 'enum', opcoes: PAPEIS, obrigatorio: true },
    { nome: 'profissao', rotulo: 'Profissão', tipo: 'texto' },
    { nome: 'taxaComissaoPadrao', rotulo: 'Comissão da clínica (%)', tipo: 'numero' },
  ],

  atualizar_usuario: [
    { nome: 'usuario_id', rotulo: 'Usuário', tipo: 'entidade', entidade: 'profissional', obrigatorio: true },
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto' },
    { nome: 'email', rotulo: 'E-mail', tipo: 'texto' },
    { nome: 'role', rotulo: 'Papel', tipo: 'enum', opcoes: PAPEIS },
    { nome: 'profissao', rotulo: 'Profissão', tipo: 'texto' },
    { nome: 'taxaComissaoPadrao', rotulo: 'Comissão da clínica (%)', tipo: 'numero' },
    { nome: 'profissionalRecebe', rotulo: 'A clínica repassa ao profissional', tipo: 'booleano' },
  ],
};

/** Fallback: deriva campos de texto a partir das chaves recebidas. */
export function camposDerivados(args: Record<string, unknown>): CampoConfirmacao[] {
  return Object.keys(args).map((nome) => ({
    nome,
    rotulo: nome.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    tipo: typeof args[nome] === 'boolean' ? 'booleano' : typeof args[nome] === 'number' ? 'numero' : 'texto',
  }));
}
