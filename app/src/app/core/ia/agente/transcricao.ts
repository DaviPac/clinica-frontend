import { Content, Part } from '@google/genai';
import { MAX_MENSAGENS_CONTEXTO } from '../ia.config';
import { Mensagem, MensagemFerramenta } from '../models/chat.model';

/**
 * Converte o histórico do chat na transcrição que o Gemini espera.
 *
 * Duas exigências da API moldam esta função:
 *
 * 1. Cada `functionCall` precisa de exatamente uma `functionResponse`, na mesma
 *    ordem, no turno IMEDIATAMENTE seguinte. Por isso as chamadas de uma mesma
 *    rodada viram um único Content de `model` e as respostas, um único Content
 *    de `user` com várias partes.
 * 2. Uma chamada ainda pendente (aguardando confirmação do usuário) não pode ser
 *    enviada, porque não existe resposta para ela. A rodada inteira é omitida
 *    nesse caso — o turno só é retomado depois que o usuário decide.
 * 3. Com thinking ligado, cada parte gerada pelo modelo carrega um
 *    `thoughtSignature` que precisa voltar exatamente onde estava. Reconstruir a
 *    parte sem ele faz a API recusar o turno com 400 INVALID_ARGUMENT
 *    ("Function call is missing a thought_signature in functionCall parts").
 */
export function toGeminiContents(mensagens: Mensagem[]): Content[] {
  const saida: Content[] = [];
  let i = 0;

  while (i < mensagens.length) {
    const m = mensagens[i];

    if (m.tipo === 'aviso') {
      i++;
      continue;
    }

    if (m.tipo === 'texto') {
      if (m.texto.trim()) {
        saida.push({
          role: m.papel === 'usuario' ? 'user' : 'model',
          parts: [
            {
              text: m.texto,
              ...(m.thoughtSignature ? { thoughtSignature: m.thoughtSignature } : {}),
            },
          ],
        });
      }
      i++;
      continue;
    }

    // Agrupa as ferramentas contíguas: elas vieram de um único turno do modelo.
    const grupo: MensagemFerramenta[] = [];
    while (i < mensagens.length && mensagens[i].tipo === 'ferramenta') {
      grupo.push(mensagens[i] as MensagemFerramenta);
      i++;
    }

    // Alguma ainda pendente ⇒ a rodada não fechou; nada dela vai para o modelo.
    if (grupo.some((f) => f.estado === 'pendente' || f.estado === 'executando')) {
      continue;
    }

    saida.push({
      role: 'model',
      parts: grupo.map(
        (f): Part => ({
          functionCall: { name: f.nome, args: f.args },
          ...(f.thoughtSignature ? { thoughtSignature: f.thoughtSignature } : {}),
        }),
      ),
    });
    saida.push({
      role: 'user',
      parts: grupo.map(
        (f): Part => ({
          functionResponse: { name: f.nome, response: respostaDe(f) },
        }),
      ),
    });
  }

  return saida;
}

function respostaDe(f: MensagemFerramenta): Record<string, unknown> {
  if (f.estado === 'cancelada') {
    return { cancelado: true, motivo: 'O usuário cancelou esta operação.' };
  }
  if (f.estado === 'erro') {
    return { erro: f.erro ?? 'Falha ao executar a operação.' };
  }
  const resultado = f.resultado;
  if (resultado && typeof resultado === 'object' && !Array.isArray(resultado)) {
    return resultado as Record<string, unknown>;
  }
  return { resultado: resultado ?? null };
}

/**
 * Recorta o histórico às últimas N mensagens, deslizando o início até uma
 * mensagem do usuário. Cortar no meio de uma rodada deixaria uma
 * `functionResponse` sem a `functionCall` correspondente e a API rejeitaria o
 * turno inteiro.
 */
export function recortarContexto(
  mensagens: Mensagem[],
  max = MAX_MENSAGENS_CONTEXTO,
): Mensagem[] {
  if (mensagens.length <= max) return mensagens;

  let inicio = mensagens.length - max;
  while (
    inicio < mensagens.length &&
    !(mensagens[inicio].tipo === 'texto' && mensagens[inicio].papel === 'usuario')
  ) {
    inicio++;
  }
  // Nenhuma mensagem de usuário na janela: melhor mandar tudo que mandar quebrado.
  if (inicio >= mensagens.length) return mensagens;

  return mensagens.slice(inicio);
}

/** Assinatura usada para detectar o modelo repetindo a mesma chamada em laço. */
export function assinaturaChamada(nome: string, args: Record<string, unknown>): string {
  return `${nome}:${JSON.stringify(args)}`;
}
