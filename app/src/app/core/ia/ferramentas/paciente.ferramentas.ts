import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  AtualizarPacienteDto,
  CriarPacienteDto,
  PacienteService,
} from '../../services/paciente/paciente.service';
import {
  AMBOS_PAPEIS,
  ContextoExecucao,
  FerramentaIA,
  ResultadoFerramenta,
} from '../models/ferramenta-ia.model';
import { Args, bool, limparUndefined, num, numObrig, str, strObrig } from './args.utils';
import {
  S,
  resumirParaModelo,
  resumirQuantidade,
  semDadosSensiveis,
} from './schema.utils';

@Injectable({ providedIn: 'root' })
export class FerramentasPaciente {
  private readonly pacientes = inject(PacienteService);

  readonly ferramentas: readonly FerramentaIA[] = [
    {
      nome: 'listar_pacientes',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'listar_pacientes',
        description:
          'Lista pacientes com nome e ID. Não traz CPF, RG nem endereço — ' +
          'para esses dados use obter_paciente com o ID específico.',
        parameters: S.obj({
          incluir_inativos: S.booleano('Inclui pacientes inativados. Padrão false.'),
          profissional_id: S.inteiro(
            'Filtra pelos pacientes de um profissional. Apenas administradores.',
          ),
          todos: S.booleano(
            'Lista pacientes de todos os profissionais. Apenas administradores.',
          ),
        }),
      },
      descreverAcao: () => 'Consultar lista de pacientes',
      executar: (args, ctx) =>
        this.pacientes
          .listar(
            ctx.isAdmin && bool(args, 'todos'),
            bool(args, 'incluir_inativos'),
            this.profissionalAlvo(args, ctx),
          )
          .pipe(
            map((lista) => ({
              paraModelo: resumirParaModelo(lista.map(semDadosSensiveis)),
              resumoUi: resumirQuantidade(lista, 'paciente', 'pacientes'),
            })),
          ),
    },

    {
      nome: 'obter_paciente',
      escopo: 'leitura',
      papeis: AMBOS_PAPEIS,
      declaracao: {
        name: 'obter_paciente',
        description: 'Busca o cadastro completo de um paciente pelo ID.',
        parameters: S.obj({ paciente_id: S.inteiro('ID do paciente.') }, ['paciente_id']),
      },
      descreverAcao: (a) => `Consultar paciente #${num(a, 'paciente_id')}`,
      executar: (args) =>
        this.pacientes
          .buscarPorId(numObrig(args, 'paciente_id'))
          .pipe(map((p) => ({ paraModelo: resumirParaModelo(p), resumoUi: p.nome }))),
    },

    {
      nome: 'criar_paciente',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'paciente',
      declaracao: {
        name: 'criar_paciente',
        description:
          'Cadastra um paciente. Se já existir alguém com o mesmo CPF, o backend ' +
          'apenas vincula o paciente existente ao profissional em vez de duplicar.',
        parameters: S.obj(
          {
            nome: S.txt('Nome completo.'),
            cpf: S.txt('CPF, só dígitos.'),
            telefone: S.txt('Telefone com DDD.'),
            dataNascimento: S.data('Data de nascimento.'),
            rg: S.txt('RG.'),
            enderecoCompleto: S.txt('Endereço completo.'),
            profissional_id: S.inteiro(
              'Profissional a quem o paciente fica vinculado. Apenas administradores.',
            ),
          },
          ['nome', 'cpf'],
        ),
      },
      descreverAcao: (a) => `Cadastrar paciente ${str(a, 'nome') ?? ''}`.trim(),
      executar: (args, ctx) => {
        const dto: CriarPacienteDto = limparUndefined({
          nome: strObrig(args, 'nome'),
          cpf: strObrig(args, 'cpf'),
          telefone: str(args, 'telefone'),
          dataNascimento: str(args, 'dataNascimento'),
          rg: str(args, 'rg'),
          enderecoCompleto: str(args, 'enderecoCompleto'),
        });
        return this.pacientes.criar(dto, this.profissionalAlvo(args, ctx)).pipe(
          map((res) => {
            // 200 = vinculou um paciente que já existia; 201 = criou um novo.
            const vinculou = res.status === 200;
            return {
              paraModelo: {
                ...resumirParaModelo(res.body),
                vinculado_a_paciente_existente: vinculou,
              },
              resumoUi: vinculou ? 'paciente existente vinculado' : 'paciente criado',
            };
          }),
        );
      },
    },

    {
      nome: 'atualizar_paciente',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'paciente',
      declaracao: {
        name: 'atualizar_paciente',
        description:
          'Atualiza o cadastro de um paciente. Envie apenas os campos que mudam. ' +
          'Campos opcionais não podem ser apagados, só alterados.',
        parameters: S.obj(
          {
            paciente_id: S.inteiro('ID do paciente.'),
            nome: S.txt('Nome completo.'),
            cpf: S.txt('CPF, só dígitos.'),
            telefone: S.txt('Telefone com DDD.'),
            dataNascimento: S.data('Data de nascimento.'),
            rg: S.txt('RG.'),
            enderecoCompleto: S.txt('Endereço completo.'),
          },
          ['paciente_id'],
        ),
      },
      descreverAcao: (a) => `Atualizar cadastro do paciente #${num(a, 'paciente_id')}`,
      executar: (args) => {
        const dto: AtualizarPacienteDto = limparUndefined({
          nome: str(args, 'nome'),
          cpf: str(args, 'cpf'),
          telefone: str(args, 'telefone'),
          dataNascimento: str(args, 'dataNascimento'),
          rg: str(args, 'rg'),
          enderecoCompleto: str(args, 'enderecoCompleto'),
        });
        return this.pacientes
          .atualizar(dto, numObrig(args, 'paciente_id'))
          .pipe(map((p) => escrita(p, 'cadastro atualizado')));
      },
    },

    {
      nome: 'inativar_paciente',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'paciente-ativacao',
      declaracao: {
        name: 'inativar_paciente',
        description: 'Inativa um paciente. O cadastro continua existindo, só sai das listas.',
        parameters: S.obj({ paciente_id: S.inteiro('ID do paciente.') }, ['paciente_id']),
      },
      descreverAcao: (a) => `Inativar paciente #${num(a, 'paciente_id')}`,
      executar: (args) =>
        this.pacientes
          .inativar(String(numObrig(args, 'paciente_id')))
          .pipe(map(() => escrita({ inativado: true }, 'paciente inativado'))),
    },

    {
      nome: 'ativar_paciente',
      escopo: 'escrita',
      papeis: AMBOS_PAPEIS,
      formulario: 'paciente-ativacao',
      declaracao: {
        name: 'ativar_paciente',
        description: 'Reativa um paciente inativado.',
        parameters: S.obj({ paciente_id: S.inteiro('ID do paciente.') }, ['paciente_id']),
      },
      descreverAcao: (a) => `Reativar paciente #${num(a, 'paciente_id')}`,
      executar: (args) =>
        this.pacientes
          .ativar(String(numObrig(args, 'paciente_id')))
          .pipe(map(() => escrita({ ativado: true }, 'paciente reativado'))),
    },
  ];

  private profissionalAlvo(args: Args, ctx: ContextoExecucao): string | undefined {
    if (!ctx.isAdmin) return String(ctx.usuario.id);
    const id = num(args, 'profissional_id');
    return id === undefined ? undefined : String(id);
  }
}

function escrita(dados: unknown, resumo: string): ResultadoFerramenta {
  return { paraModelo: resumirParaModelo(dados), resumoUi: resumo };
}
