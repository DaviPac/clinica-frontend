import { Injectable, inject } from '@angular/core';
import { map, switchMap } from 'rxjs';
import {
  AtualizarUsuarioDto,
  RegistrarUsuarioDto,
  UsuarioService,
} from '../../services/usuario/usuario.service';
import { Role } from '../../models/usuario.model';
import { FerramentaIA, ResultadoFerramenta, SO_ADMIN } from '../models/ferramenta-ia.model';
import { Args, bool, enumObrig, num, numObrig, str, strObrig } from './args.utils';
import { S, SEM_PARAMETROS, resumirParaModelo, resumirQuantidade } from './schema.utils';

const PAPEIS: readonly Role[] = ['ADMIN', 'PROFISSIONAL'];

@Injectable({ providedIn: 'root' })
export class FerramentasUsuario {
  private readonly usuarios = inject(UsuarioService);

  readonly ferramentas: readonly FerramentaIA[] = [
    {
      nome: 'listar_usuarios',
      escopo: 'leitura',
      papeis: SO_ADMIN,
      declaracao: {
        name: 'listar_usuarios',
        description: 'Lista os usuários do sistema (administradores e profissionais).',
        parameters: SEM_PARAMETROS,
      },
      descreverAcao: () => 'Consultar usuários do sistema',
      executar: () =>
        this.usuarios.listar().pipe(
          map((lista) => ({
            paraModelo: resumirParaModelo(lista),
            resumoUi: resumirQuantidade(lista, 'usuário', 'usuários'),
          })),
        ),
    },

    {
      nome: 'obter_usuario',
      escopo: 'leitura',
      papeis: SO_ADMIN,
      declaracao: {
        name: 'obter_usuario',
        description: 'Busca um usuário pelo ID.',
        parameters: S.obj({ usuario_id: S.inteiro('ID do usuário.') }, ['usuario_id']),
      },
      descreverAcao: (a) => `Consultar usuário #${num(a, 'usuario_id')}`,
      executar: (args) =>
        this.usuarios
          .buscarPorId(numObrig(args, 'usuario_id'))
          .pipe(map((u) => ({ paraModelo: resumirParaModelo(u), resumoUi: u.nome }))),
    },

    {
      nome: 'criar_usuario',
      escopo: 'escrita',
      papeis: SO_ADMIN,
      formulario: 'usuario',
      declaracao: {
        name: 'criar_usuario',
        description:
          'Cria um usuário do sistema. A senha inicial NÃO é definida aqui: ela é ' +
          'digitada pelo administrador no formulário de confirmação.',
        // Sem parâmetro `senha`: o modelo nunca vê, propõe nem repete uma senha.
        parameters: S.obj(
          {
            nome: S.txt('Nome completo.'),
            email: S.txt('E-mail de acesso.'),
            role: S.opcoes('Papel do usuário.', PAPEIS),
            profissao: S.txt('Profissão, para profissionais.'),
            taxaComissaoPadrao: S.numero(
              'Percentual de comissão da clínica, entre 0 e 100. Ex.: 40 para 40%. Padrão 40.',
            ),
          },
          ['nome', 'email', 'role'],
        ),
      },
      descreverAcao: (a) => `Criar usuário ${str(a, 'nome') ?? ''} (${str(a, 'role') ?? ''})`,
      executar: (args) => {
        const senha = str(args, 'senha');
        if (!senha) {
          throw new Error('Defina uma senha inicial no formulário antes de confirmar.');
        }
        const dto: RegistrarUsuarioDto = {
          nome: strObrig(args, 'nome'),
          email: strObrig(args, 'email'),
          senha,
          role: enumObrig(args, 'role', PAPEIS),
          ...(str(args, 'profissao') ? { profissao: strObrig(args, 'profissao') } : {}),
          ...(num(args, 'taxaComissaoPadrao') !== undefined
            ? { taxaComissaoPadrao: numObrig(args, 'taxaComissaoPadrao') }
            : {}),
        };
        return this.usuarios.registrar(dto).pipe(map((u) => escrita(u, 'usuário criado')));
      },
    },

    {
      nome: 'atualizar_usuario',
      escopo: 'escrita',
      papeis: SO_ADMIN,
      formulario: 'usuario',
      declaracao: {
        name: 'atualizar_usuario',
        description:
          'Atualiza um usuário. Envie apenas os campos que mudam — os demais são ' +
          'preservados automaticamente. Não altera senha.',
        parameters: S.obj(
          {
            usuario_id: S.inteiro('ID do usuário.'),
            nome: S.txt('Nome completo.'),
            email: S.txt('E-mail de acesso.'),
            role: S.opcoes('Papel do usuário.', PAPEIS),
            profissao: S.txt('Profissão.'),
            taxaComissaoPadrao: S.numero('Percentual de comissão da clínica, entre 0 e 100.'),
            profissionalRecebe: S.booleano(
              'true quando a clínica repassa ao profissional; false quando é o contrário.',
            ),
          },
          ['usuario_id'],
        ),
      },
      descreverAcao: (a) => `Atualizar usuário #${num(a, 'usuario_id')}`,
      executar: (args) => this.atualizarMesclando(args),
    },
  ];

  /**
   * `PUT /usuarios/:id` substitui o registro inteiro; buscar e mesclar evita que
   * uma edição parcial apague profissão, comissão ou papel.
   */
  private atualizarMesclando(args: Args) {
    const id = numObrig(args, 'usuario_id');
    return this.usuarios.buscarPorId(id).pipe(
      switchMap((atual) => {
        const dto: AtualizarUsuarioDto = {
          nome: str(args, 'nome') ?? atual.nome,
          email: str(args, 'email') ?? atual.email,
          role: args['role'] === undefined ? atual.role : enumObrig(args, 'role', PAPEIS),
          profissao: str(args, 'profissao') ?? atual.profissao ?? undefined,
          taxaComissaoPadrao: num(args, 'taxaComissaoPadrao') ?? atual.taxaComissaoPadrao,
          profissionalRecebe:
            args['profissionalRecebe'] === undefined
              ? atual.profissionalRecebe
              : bool(args, 'profissionalRecebe'),
        };
        return this.usuarios.atualizar(id, dto);
      }),
      map((u) => escrita(u, 'usuário atualizado')),
    );
  }
}

function escrita(dados: unknown, resumo: string): ResultadoFerramenta {
  return { paraModelo: resumirParaModelo(dados), resumoUi: resumo };
}
