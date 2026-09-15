import { Injectable, inject } from '@angular/core';
import { map, switchMap } from 'rxjs';
import {
  AgendamentoDto,
  AgendamentoService,
} from '../../services/agendamento/agendamento.service';
import { StatusAgendamento } from '../../models/agendamento.model';
import { formatarMoeda, toRFC3339Brasilia } from '../../utils/data.utils';
import { transicaoValida } from '../../../features/agendamentos/agendamento.regras';
import {
  AMBOS_PAPEIS,
  ContextoExecucao,
  FerramentaIA,
  ResultadoFerramenta,
} from '../models/ferramenta-ia.model';
import { Args, bool, enumObrig, num, numObrig, str, strObrig } from './args.utils';
import { S, SEM_PARAMETROS, resumirParaModelo, resumirQuantidade } from './schema.utils';

const STATUS: readonly StatusAgendamento[] = ['AGENDADO', 'REALIZADO', 'FALTA', 'CANCELADO'];

@Injectable({ providedIn: 'root' })
export class FerramentasAgendamento {
  private readonly agendamentos = inject(AgendamentoService);

  readonly ferramentas: readonly FerramentaIA[] = [
    {
      nome: 'listar_agendamentos',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'listar_agendamentos',
        description:
          'Lista agendamentos num período. Use sempre esta ferramenta antes de citar ' +
          'um ID de agendamento — nunca invente IDs.',
        parameters: S.obj(
          {
            de: S.data('Início do período.'),
            ate: S.data('Fim do período.'),
            profissional_id: S.inteiro(
              'Filtra por profissional. Apenas administradores podem usar; ' +
                'se omitido, um admin vê todos os profissionais.',
            ),
            paciente_id: S.inteiro('Filtra por paciente.'),
          },
          ['de', 'ate'],
        ),
      },
      descreverAcao: (a) => `Consultar agendamentos de ${str(a, 'de')} a ${str(a, 'ate')}`,
      executar: (args, ctx) =>
        this.agendamentos
          .listar({
            periodo: { de: strObrig(args, 'de'), ate: strObrig(args, 'ate') },
            profissionalId: this.profissionalAlvo(args, ctx),
            pacienteId: num(args, 'paciente_id'),
          })
          .pipe(map((r) => leitura(r, 'agendamento', 'agendamentos'))),
    },

    {
      nome: 'obter_agendamento',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'obter_agendamento',
        description: 'Busca um agendamento específico pelo ID.',
        parameters: S.obj({ agendamento_id: S.inteiro('ID do agendamento.') }, [
          'agendamento_id',
        ]),
      },
      descreverAcao: (a) => `Consultar agendamento #${num(a, 'agendamento_id')}`,
      executar: (args) =>
        this.agendamentos
          .obterPorId(numObrig(args, 'agendamento_id'))
          .pipe(map((r) => leitura(r, 'agendamento', 'agendamentos'))),
    },

    {
      nome: 'listar_agendamentos_pendentes',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'listar_agendamentos_pendentes',
        description:
          'Lista agendamentos passados que ainda estão com status AGENDADO, ' +
          'ou seja, aguardando confirmação de realização ou falta.',
        parameters: SEM_PARAMETROS,
      },
      descreverAcao: () => 'Consultar agendamentos pendentes de confirmação',
      executar: (_args, ctx) =>
        this.agendamentos
          .listarPendentes(ctx.isAdmin)
          .pipe(map((r) => leitura(r, 'agendamento pendente', 'agendamentos pendentes'))),
    },

    {
      nome: 'listar_pagamentos_pendentes',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'listar_pagamentos_pendentes',
        description: 'Lista agendamentos realizados que ainda não foram pagos pelo paciente.',
        parameters: SEM_PARAMETROS,
      },
      descreverAcao: () => 'Consultar pagamentos pendentes',
      executar: (_args, ctx) =>
        this.agendamentos
          .listarPagamentoPendente(ctx.isAdmin)
          .pipe(map((r) => leitura(r, 'pagamento pendente', 'pagamentos pendentes'))),
    },

    {
      nome: 'criar_agendamento',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'agendamento-criar',
      declaracao: {
        name: 'criar_agendamento',
        description:
          'Cria um agendamento (ou uma série recorrente). ' +
          'Se o serviço escolhido for um pacote (is_pacote = true), envie recorrente = true, ' +
          'pacote = true e valor_combinado com o valor TOTAL do pacote, não o valor por sessão.',
        parameters: S.obj(
          {
            paciente_id: S.inteiro('ID do paciente.'),
            servico_id: S.inteiro('ID do serviço.'),
            data_hora_inicio: S.dataHora('Início da primeira sessão.'),
            duracao_minutos: S.inteiro('Duração de cada sessão em minutos, mínimo 1.'),
            valor_combinado: S.numero(
              'Valor em reais, mínimo 0,01. Para pacotes, o valor total do pacote.',
            ),
            recorrente: S.booleano('Se a série se repete semanalmente.'),
            pacote: S.booleano('Se o serviço é um pacote fechado.'),
            total_sessoes: S.inteiro('Quantidade de sessões, mínimo 2, quando recorrente.'),
            intervalo_semanas: S.inteiro('Intervalo entre sessões em semanas. Padrão 1.'),
            profissional_id: S.inteiro(
              'Profissional dono do agendamento. Apenas administradores podem definir, '
                + 'e para eles é obrigatório.',
            ),
          },
          [
            'paciente_id',
            'servico_id',
            'data_hora_inicio',
            'duracao_minutos',
            'valor_combinado',
            'recorrente',
            'pacote',
          ],
        ),
      },
      descreverAcao: (a) =>
        bool(a, 'recorrente')
          ? `Criar série de ${num(a, 'total_sessoes') ?? '?'} sessões`
          : 'Criar agendamento',
      executar: (args, ctx) => {
        const recorrente = bool(args, 'recorrente');
        const dto: AgendamentoDto = {
          paciente_id: numObrig(args, 'paciente_id'),
          servico_id: numObrig(args, 'servico_id'),
          data_hora_inicio: paraRfc3339(strObrig(args, 'data_hora_inicio')),
          duracao_minutos: numObrig(args, 'duracao_minutos'),
          valor_combinado: numObrig(args, 'valor_combinado'),
          recorrente,
          pacote: bool(args, 'pacote'),
          ...(recorrente
            ? {
                total_sessoes: num(args, 'total_sessoes') ?? 1,
                intervalo_semanas: num(args, 'intervalo_semanas') ?? 1,
              }
            : {}),
        };
        const profissionalId = this.profissionalAlvo(args, ctx);
        return this.agendamentos.criar(dto, profissionalId?.toString()).pipe(
          map((r) => {
            const serie = r as { total_criados?: number };
            return {
              paraModelo: resumirParaModelo(r),
              resumoUi: serie.total_criados
                ? `${serie.total_criados} sessões criadas`
                : 'agendamento criado',
            };
          }),
        );
      },
    },

    {
      nome: 'atualizar_status_agendamento',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'agendamento-status',
      declaracao: {
        name: 'atualizar_status_agendamento',
        description:
          'Altera o status de um agendamento. Transições válidas: ' +
          'AGENDADO → REALIZADO, FALTA ou CANCELADO; REALIZADO → AGENDADO; ' +
          'FALTA → AGENDADO ou CANCELADO. CANCELADO é final.',
        parameters: S.obj(
          {
            agendamento_id: S.inteiro('ID do agendamento (não é o ID do paciente).'),
            status: S.opcoes('Novo status.', STATUS),
          },
          ['agendamento_id', 'status'],
        ),
      },
      descreverAcao: (a) =>
        `Marcar agendamento #${num(a, 'agendamento_id')} como ${str(a, 'status')}`,
      executar: (args) => {
        const id = numObrig(args, 'agendamento_id');
        const destino = enumObrig(args, 'status', STATUS);

        // Mesma regra da tela de status: CANCELADO é terminal, REALIZADO só
        // volta para AGENDADO. Recusar aqui evita um 4xx e uma explicação ruim.
        return this.agendamentos.obterPorId(id).pipe(
          switchMap((atual) => {
            if (atual && !transicaoValida(atual.status, destino)) {
              throw new Error(
                `Não é possível mudar de ${atual.status} para ${destino}.`,
              );
            }
            return this.agendamentos.atualizarStatus(id, destino);
          }),
          map((r) => escrita(r, 'status atualizado')),
        );
      },
    },

    {
      nome: 'atualizar_valor_agendamento',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'agendamento-valor',
      declaracao: {
        name: 'atualizar_valor_agendamento',
        description: 'Altera o valor combinado de um agendamento ou de toda a série recorrente.',
        parameters: S.obj(
          {
            agendamento_id: S.inteiro('ID do agendamento.'),
            valor_combinado: S.numero('Novo valor em reais.'),
            recorrente: S.booleano('Se true, aplica a toda a série. Padrão false.'),
          },
          ['agendamento_id', 'valor_combinado'],
        ),
      },
      descreverAcao: (a) =>
        `Alterar valor do agendamento #${num(a, 'agendamento_id')} para ${formatarMoeda(num(a, 'valor_combinado'))}`,
      executar: (args) =>
        this.agendamentos
          .atualizarValor(
            numObrig(args, 'agendamento_id'),
            numObrig(args, 'valor_combinado'),
            bool(args, 'recorrente'),
          )
          .pipe(map((r) => escrita(r, 'valor atualizado'))),
    },

    {
      nome: 'atualizar_pagamento_agendamento',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'agendamento-pagamento',
      declaracao: {
        name: 'atualizar_pagamento_agendamento',
        description: 'Marca um agendamento como pago ou não pago pelo paciente.',
        parameters: S.obj(
          {
            agendamento_id: S.inteiro('ID do agendamento.'),
            pago: S.booleano('true para pago, false para não pago.'),
          },
          ['agendamento_id', 'pago'],
        ),
      },
      descreverAcao: (a) =>
        `Marcar agendamento #${num(a, 'agendamento_id')} como ${bool(a, 'pago') ? 'pago' : 'não pago'}`,
      executar: (args) =>
        this.agendamentos
          .atualizarPagamento(numObrig(args, 'agendamento_id'), bool(args, 'pago'))
          .pipe(map((r) => escrita(r, 'pagamento atualizado'))),
    },

    {
      nome: 'reagendar_agendamento',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'agendamento-reagendar',
      declaracao: {
        name: 'reagendar_agendamento',
        description: 'Move um agendamento (ou toda a série) para uma nova data e hora.',
        parameters: S.obj(
          {
            agendamento_id: S.inteiro('ID do agendamento.'),
            novo_inicio: S.dataHora('Novo início.'),
            duracao_minutos: S.inteiro('Duração da sessão em minutos.'),
            reagendar_recorrencia: S.booleano(
              'Se true, desloca também as sessões seguintes da série.',
            ),
            intervalo_semanas: S.inteiro('Intervalo entre sessões da série. Padrão 1.'),
          },
          ['agendamento_id', 'novo_inicio', 'duracao_minutos'],
        ),
      },
      descreverAcao: (a) =>
        `Reagendar agendamento #${num(a, 'agendamento_id')} para ${str(a, 'novo_inicio')}`,
      executar: (args) => {
        const inicio = new Date(strObrig(args, 'novo_inicio'));
        const fim = new Date(inicio.getTime() + numObrig(args, 'duracao_minutos') * 60_000);
        return this.agendamentos
          .reagendar(
            numObrig(args, 'agendamento_id'),
            toRFC3339Brasilia(inicio),
            toRFC3339Brasilia(fim),
            bool(args, 'reagendar_recorrencia'),
            num(args, 'intervalo_semanas') ?? 1,
          )
          .pipe(map(() => escrita({ reagendado: true }, 'reagendado')));
      },
    },

    {
      nome: 'cancelar_recorrencia',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'agendamento-recorrencia',
      declaracao: {
        name: 'cancelar_recorrencia',
        description:
          'Cancela todos os agendamentos futuros de uma série recorrente. ' +
          'Informe o ID de qualquer agendamento da série: o grupo é derivado dele.',
        parameters: S.obj(
          {
            agendamento_id: S.inteiro('ID de um agendamento pertencente à série.'),
            group_id: S.txt(
              'ID do grupo de recorrência, se já conhecido. Dispensável quando '
                + 'agendamento_id é informado.',
            ),
          },
          ['agendamento_id'],
        ),
      },
      descreverAcao: () => 'Cancelar série recorrente de agendamentos',
      executar: (args) => {
        // A tela cancela pelo botão da própria série; ninguém digita o UUID.
        const informado = str(args, 'group_id');
        if (informado) {
          return this.agendamentos
            .cancelarRecorrencia(informado)
            .pipe(map((r) => escrita(r, 'série cancelada')));
        }

        return this.agendamentos.obterPorId(numObrig(args, 'agendamento_id')).pipe(
          switchMap((ag) => {
            if (!ag?.recorrenciaGroupId) {
              throw new Error('Este agendamento não faz parte de uma série recorrente.');
            }
            return this.agendamentos.cancelarRecorrencia(ag.recorrenciaGroupId);
          }),
          map((r) => escrita(r, 'série cancelada')),
        );
      },
    },
  ];

  /**
   * `AgendamentoService.listar` manda `todos=true` sempre que recebe `opts` sem
   * `profissionalId`. Um PROFISSIONAL nunca pode cair nesse caminho, então o ID
   * dele é forçado; só ADMIN pode omitir (ver todos) ou apontar para outro.
   */
  private profissionalAlvo(args: Args, ctx: ContextoExecucao): number | undefined {
    if (!ctx.isAdmin) return ctx.usuario.id;
    return num(args, 'profissional_id');
  }
}

function leitura(dados: unknown, singular: string, plural: string): ResultadoFerramenta {
  return {
    paraModelo: resumirParaModelo(dados),
    resumoUi: resumirQuantidade(dados, singular, plural),
  };
}

function escrita(dados: unknown, resumo: string): ResultadoFerramenta {
  return { paraModelo: resumirParaModelo(dados), resumoUi: resumo };
}

/** O modelo manda "YYYY-MM-DDTHH:mm"; o backend exige RFC3339 com offset -03:00. */
function paraRfc3339(valor: string): string {
  return toRFC3339Brasilia(new Date(valor));
}
