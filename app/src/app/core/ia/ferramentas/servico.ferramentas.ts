import { Injectable, inject } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { AtualizarServicoDto, ServicoService } from '../../services/servico/servico.service';
import {
  AMBOS_PAPEIS,
  ContextoExecucao,
  FerramentaIA,
  ResultadoFerramenta,
} from '../models/ferramenta-ia.model';
import { Args, bool, num, numObrig, str, strObrig } from './args.utils';
import { S, resumirParaModelo, resumirQuantidade } from './schema.utils';

@Injectable({ providedIn: 'root' })
export class FerramentasServico {
  private readonly servicos = inject(ServicoService);

  readonly ferramentas: readonly FerramentaIA[] = [
    {
      nome: 'listar_servicos',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'listar_servicos',
        description:
          'Lista serviços com valor e se são pacote. O campo is_pacote indica pacote fechado: ' +
          'agendamentos desse serviço são obrigatoriamente recorrentes e o valor combinado ' +
          'é o total do pacote.',
        parameters: S.obj({
          incluir_inativos: S.booleano('Inclui serviços desativados. Padrão false.'),
          profissional_id: S.inteiro(
            'Filtra pelos serviços de um profissional. Apenas administradores.',
          ),
        }),
      },
      descreverAcao: () => 'Consultar serviços disponíveis',
      executar: (args, ctx) =>
        this.servicos
          .listar({
            profissionalId: this.profissionalAlvo(args, ctx),
            incluirInativos: bool(args, 'incluir_inativos'),
          })
          .pipe(
            map((lista) => ({
              paraModelo: resumirParaModelo(lista),
              resumoUi: resumirQuantidade(lista, 'serviço', 'serviços'),
            })),
          ),
    },

    {
      nome: 'criar_servico',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'servico',
      declaracao: {
        name: 'criar_servico',
        description: 'Cria um serviço ou pacote.',
        parameters: S.obj(
          {
            nome: S.txt('Nome do serviço.'),
            valor_atual: S.numero('Valor em reais, mínimo 0,01. Para pacote, o valor total.'),
            pacote: S.booleano('Se é um pacote fechado de sessões.'),
            profissional_id: S.inteiro(
              'Profissional dono do serviço. Apenas administradores.',
            ),
          },
          ['nome', 'valor_atual', 'pacote'],
        ),
      },
      descreverAcao: (a) => `Criar serviço "${str(a, 'nome') ?? ''}"`,
      executar: (args, ctx) =>
        this.servicos
          .criar(
            {
              nome: strObrig(args, 'nome'),
              valor_atual: numObrig(args, 'valor_atual'),
              pacote: bool(args, 'pacote'),
            },
            { profissionalId: this.profissionalAlvo(args, ctx) },
          )
          .pipe(map((s) => escrita(s, 'serviço criado'))),
    },

    {
      nome: 'atualizar_servico',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'servico',
      declaracao: {
        name: 'atualizar_servico',
        description:
          'Atualiza um serviço. Envie apenas os campos que mudam — os demais são ' +
          'preservados automaticamente.',
        parameters: S.obj(
          {
            servico_id: S.inteiro('ID do serviço.'),
            nome: S.txt('Nome do serviço.'),
            valor_atual: S.numero('Valor em reais.'),
            pacote: S.booleano('Se é um pacote fechado.'),
            ativo: S.booleano('Se o serviço está ativo.'),
          },
          ['servico_id'],
        ),
      },
      descreverAcao: (a) => `Atualizar serviço #${num(a, 'servico_id')}`,
      executar: (args, ctx) => this.atualizarMesclando(args, ctx),
    },

    {
      nome: 'desativar_servico',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'servico-desativar',
      declaracao: {
        name: 'desativar_servico',
        description:
          'Desativa um serviço. Ele continua existindo e vinculado a agendamentos antigos.',
        parameters: S.obj({ servico_id: S.inteiro('ID do serviço.') }, ['servico_id']),
      },
      descreverAcao: (a) => `Desativar serviço #${num(a, 'servico_id')}`,
      executar: (args) =>
        this.servicos
          .desativar(numObrig(args, 'servico_id'))
          .pipe(map(() => escrita({ desativado: true }, 'serviço desativado'))),
    },
  ];

  /**
   * `PUT /servicos/:id` substitui o registro inteiro: enviar só o preço zeraria
   * `ativo` e `pacote`. Por isso o serviço atual é buscado e os argumentos são
   * mesclados por cima antes de gravar.
   *
   * Também é aqui que mora a assimetria do backend: a leitura devolve
   * `is_pacote`, a escrita espera `pacote`.
   */
  private atualizarMesclando(args: Args, ctx: ContextoExecucao) {
    const id = numObrig(args, 'servico_id');
    return this.servicos
      .listar({ profissionalId: this.profissionalAlvo(args, ctx), incluirInativos: true })
      .pipe(
        switchMap((lista) => {
          const atual = lista.find((s) => s.id === id);
          if (!atual) throw new Error(`Serviço #${id} não encontrado.`);

          const dto: AtualizarServicoDto = {
            nome: str(args, 'nome') ?? atual.nome,
            valor_atual: num(args, 'valor_atual') ?? atual.valor_atual,
            pacote: args['pacote'] === undefined ? atual.is_pacote : bool(args, 'pacote'),
            ativo: args['ativo'] === undefined ? atual.ativo : bool(args, 'ativo'),
          };
          return this.servicos.atualizar(id, dto);
        }),
        map((s) => escrita(s, 'serviço atualizado')),
      );
  }

  private profissionalAlvo(args: Args, ctx: ContextoExecucao): number | undefined {
    if (!ctx.isAdmin) return ctx.usuario.id;
    return num(args, 'profissional_id');
  }
}

function escrita(dados: unknown, resumo: string): ResultadoFerramenta {
  return { paraModelo: resumirParaModelo(dados), resumoUi: resumo };
}
