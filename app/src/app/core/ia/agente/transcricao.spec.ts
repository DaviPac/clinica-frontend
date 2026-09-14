import { describe, expect, it } from 'vitest';
import { Mensagem, MensagemFerramenta, MensagemTexto } from '../models/chat.model';
import { recortarContexto, toGeminiContents } from './transcricao';

let contador = 0;

function texto(papel: 'usuario' | 'assistente', conteudo: string): MensagemTexto {
  return {
    id: `t${contador++}`,
    conversaId: 'c1',
    ordem: contador,
    criadoEm: new Date().toISOString(),
    tipo: 'texto',
    papel,
    texto: conteudo,
  };
}

function ferramenta(
  nome: string,
  estado: MensagemFerramenta['estado'],
  extras: Partial<MensagemFerramenta> = {},
): MensagemFerramenta {
  return {
    id: `f${contador++}`,
    conversaId: 'c1',
    ordem: contador,
    criadoEm: new Date().toISOString(),
    tipo: 'ferramenta',
    papel: 'assistente',
    chamadaId: `ch${contador}`,
    nome,
    escopo: 'leitura',
    descricao: nome,
    args: { a: 1 },
    estado,
    ...extras,
  };
}

describe('toGeminiContents', () => {
  it('converte texto de usuário e assistente nos papéis da API', () => {
    const contents = toGeminiContents([
      texto('usuario', 'oi'),
      texto('assistente', 'olá'),
    ]);

    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'oi' }] },
      { role: 'model', parts: [{ text: 'olá' }] },
    ]);
  });

  it('emite uma functionResponse para cada functionCall, na mesma ordem', () => {
    const contents = toGeminiContents([
      texto('usuario', 'liste tudo'),
      ferramenta('listar_pacientes', 'executada', { resultado: { total: 2 } }),
      ferramenta('listar_servicos', 'executada', { resultado: { total: 5 } }),
    ]);

    const chamadas = contents[1];
    const respostas = contents[2];

    expect(chamadas.role).toBe('model');
    expect(chamadas.parts).toHaveLength(2);
    expect(respostas.role).toBe('user');
    expect(respostas.parts).toHaveLength(2);

    expect(chamadas.parts?.[0].functionCall?.name).toBe('listar_pacientes');
    expect(respostas.parts?.[0].functionResponse?.name).toBe('listar_pacientes');
    expect(chamadas.parts?.[1].functionCall?.name).toBe('listar_servicos');
    expect(respostas.parts?.[1].functionResponse?.name).toBe('listar_servicos');
  });

  it('omite a rodada inteira enquanto uma chamada aguarda confirmação', () => {
    const contents = toGeminiContents([
      texto('usuario', 'crie um paciente'),
      ferramenta('criar_paciente', 'pendente', { escopo: 'escrita' }),
    ]);

    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'crie um paciente' }] }]);
  });

  it('transforma cancelamento e erro em resposta, para a transcrição não quebrar', () => {
    const contents = toGeminiContents([
      texto('usuario', 'faça duas coisas'),
      ferramenta('criar_paciente', 'cancelada', { escopo: 'escrita' }),
      ferramenta('criar_servico', 'erro', { escopo: 'escrita', erro: 'CPF inválido' }),
    ]);

    const respostas = contents[2].parts ?? [];
    expect(respostas[0].functionResponse?.response).toMatchObject({ cancelado: true });
    expect(respostas[1].functionResponse?.response).toMatchObject({ erro: 'CPF inválido' });
  });

  it('devolve o thoughtSignature junto da functionCall', () => {
    // Com thinking ligado a API exige a assinatura de volta na mesma parte;
    // sem ela responde 400 "Function call is missing a thought_signature".
    const contents = toGeminiContents([
      texto('usuario', 'liste'),
      ferramenta('listar_agendamentos', 'executada', {
        resultado: { total: 13 },
        thoughtSignature: 'assinatura-opaca-abc',
      }),
    ]);

    expect(contents[1].parts?.[0].thoughtSignature).toBe('assinatura-opaca-abc');
  });

  it('devolve o thoughtSignature de uma mensagem de texto do modelo', () => {
    const comAssinatura: MensagemTexto = {
      ...texto('assistente', 'pronto'),
      thoughtSignature: 'assinatura-texto',
    };

    const contents = toGeminiContents([texto('usuario', 'oi'), comAssinatura]);

    expect(contents[1].parts?.[0].thoughtSignature).toBe('assinatura-texto');
  });

  it('omite thoughtSignature quando o modelo não enviou nenhum', () => {
    const contents = toGeminiContents([
      texto('usuario', 'liste'),
      ferramenta('listar_agendamentos', 'executada', { resultado: {} }),
    ]);

    expect(contents[1].parts?.[0]).not.toHaveProperty('thoughtSignature');
  });

  it('ignora avisos internos', () => {
    const aviso: Mensagem = {
      id: 'a1',
      conversaId: 'c1',
      ordem: 99,
      criadoEm: new Date().toISOString(),
      tipo: 'aviso',
      papel: 'sistema',
      texto: 'interrompido',
    };

    expect(toGeminiContents([texto('usuario', 'oi'), aviso])).toHaveLength(1);
  });
});

describe('recortarContexto', () => {
  it('devolve tudo quando cabe no limite', () => {
    const mensagens = [texto('usuario', 'a'), texto('assistente', 'b')];
    expect(recortarContexto(mensagens, 10)).toHaveLength(2);
  });

  it('desliza o início até uma mensagem de usuário para não órfãos de chamada', () => {
    const mensagens: Mensagem[] = [
      texto('usuario', 'primeira'),
      ferramenta('listar_pacientes', 'executada'),
      texto('assistente', 'resposta'),
      texto('usuario', 'segunda'),
      ferramenta('listar_servicos', 'executada'),
    ];

    // Um corte cru em 2 começaria numa mensagem do assistente, deixando a
    // functionResponse anterior sem a chamada correspondente.
    const recortado = recortarContexto(mensagens, 3);

    expect(recortado[0].tipo).toBe('texto');
    expect((recortado[0] as MensagemTexto).papel).toBe('usuario');
    expect((recortado[0] as MensagemTexto).texto).toBe('segunda');
  });

  it('prefere mandar tudo a mandar um histórico quebrado', () => {
    const mensagens: Mensagem[] = [
      texto('usuario', 'primeira'),
      ferramenta('listar_pacientes', 'executada'),
      ferramenta('listar_servicos', 'executada'),
    ];

    expect(recortarContexto(mensagens, 1)).toHaveLength(3);
  });
});
