import { Injectable, inject } from '@angular/core';
import {
  Content,
  FunctionCallingConfigMode,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
  Tool,
} from '@google/genai';
import { firstValueFrom } from 'rxjs';
import { GeminiService } from '../../services/gemini/gemini.service';
import { NivelRaciocinio, ORCAMENTO_RACIOCINIO } from '../ia.config';
import { UsoTurno } from '../models/chat.model';

export interface PedidoModelo {
  modelo: string;
  raciocinio: NivelRaciocinio;
  instrucaoSistema: string;
  contents: Content[];
  ferramentas: Tool[];
  /** Recebe os pedaços de texto conforme chegam. */
  onTexto?: (delta: string) => void;
  /** Recebe os pedaços do raciocínio (thinking) conforme chegam. */
  onRaciocinio?: (delta: string) => void;
  sinal?: AbortSignal;
}

export interface ChamadaBruta {
  nome: string;
  args: Record<string, unknown>;
  /**
   * Assinatura do raciocínio que produziu esta chamada. Com thinking ligado, a
   * API exige que ela volte junto da functionCall no turno seguinte — sem isso
   * responde 400 INVALID_ARGUMENT.
   */
  thoughtSignature?: string;
}

export interface RespostaModelo {
  texto: string;
  raciocinio: string;
  chamadas: ChamadaBruta[];
  uso: UsoTurno;
  /** Assinatura da última parte de texto, quando houver. */
  thoughtSignature?: string;
}

/** Erro de cota (429) — carrega a mensagem original do Google para exibição. */
export class ErroCotaIA extends Error {
  constructor(public readonly detalhe: string) {
    super('Limite de uso da chave atingido.');
    this.name = 'ErroCotaIA';
  }
}

const USO_VAZIO: UsoTurno = { prompt: 0, resposta: 0, raciocinio: 0, total: 0 };

/**
 * Única porta de entrada para o SDK do Gemini.
 *
 * Todo o resto do módulo depende só de `RespostaModelo`, então trocar de SDK ou
 * mover a chamada para o backend fica confinado a este arquivo.
 */
@Injectable({ providedIn: 'root' })
export class GeminiChatClient {
  private readonly geminiService = inject(GeminiService);

  /** Só em memória — nunca vai para o IndexedDB nem para o localStorage. */
  private chave: string | null = null;
  private buscandoChave: Promise<string> | null = null;

  async garantirChave(): Promise<string> {
    if (this.chave) return this.chave;
    this.buscandoChave ??= firstValueFrom(this.geminiService.obterApiKey())
      .then((r) => {
        if (!r?.api_key) throw new Error('O servidor não devolveu a chave da IA.');
        this.chave = r.api_key;
        return r.api_key;
      })
      .catch((err: unknown) => {
        this.buscandoChave = null;
        throw err;
      });
    return this.buscandoChave;
  }

  async cliente(): Promise<GoogleGenAI> {
    return new GoogleGenAI({ apiKey: await this.garantirChave() });
  }

  async gerar(pedido: PedidoModelo): Promise<RespostaModelo> {
    const ai = await this.cliente();

    let texto = '';
    let raciocinio = '';
    const chamadas: ChamadaBruta[] = [];
    let uso: UsoTurno = { ...USO_VAZIO };
    let assinaturaTexto: string | undefined;

    try {
      const fluxo = await ai.models.generateContentStream({
        model: pedido.modelo,
        contents: pedido.contents,
        config: {
          systemInstruction: pedido.instrucaoSistema,
          tools: pedido.ferramentas,
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
          temperature: 0.2,
          ...(pedido.sinal ? { abortSignal: pedido.sinal } : {}),
          ...this.configRaciocinio(pedido.raciocinio),
        },
      });

      for await (const parcial of fluxo) {
        this.acumularBloqueio(parcial);

        for (const parte of partesDe(parcial)) {
          if (parte.functionCall?.name) {
            chamadas.push({
              nome: parte.functionCall.name,
              args: (parte.functionCall.args ?? {}) as Record<string, unknown>,
              ...(parte.thoughtSignature
                ? { thoughtSignature: parte.thoughtSignature }
                : {}),
            });
            continue;
          }
          if (!parte.text) continue;

          if (parte.thought) {
            raciocinio += parte.text;
            pedido.onRaciocinio?.(parte.text);
          } else {
            texto += parte.text;
            if (parte.thoughtSignature) assinaturaTexto = parte.thoughtSignature;
            pedido.onTexto?.(parte.text);
          }
        }

        if (parcial.usageMetadata) uso = paraUso(parcial.usageMetadata);
      }
    } catch (err: unknown) {
      throw traduzirErro(err);
    }

    return {
      texto: texto.trim(),
      raciocinio: raciocinio.trim(),
      chamadas,
      uso,
      ...(assinaturaTexto ? { thoughtSignature: assinaturaTexto } : {}),
    };
  }

  private configRaciocinio(nivel: NivelRaciocinio) {
    if (nivel === 'desligado') return {};
    return {
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: ORCAMENTO_RACIOCINIO[nivel],
      },
    };
  }

  private acumularBloqueio(parcial: GenerateContentResponse): void {
    const motivo = parcial.promptFeedback?.blockReason;
    if (motivo) {
      throw new Error(
        'A mensagem foi bloqueada pelos filtros de segurança do modelo. Reformule e tente de novo.',
      );
    }
  }
}

function partesDe(resposta: GenerateContentResponse): Part[] {
  return resposta.candidates?.[0]?.content?.parts ?? [];
}

function paraUso(meta: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}): UsoTurno {
  return {
    prompt: meta.promptTokenCount ?? 0,
    resposta: meta.candidatesTokenCount ?? 0,
    raciocinio: meta.thoughtsTokenCount ?? 0,
    total: meta.totalTokenCount ?? 0,
  };
}

/**
 * A API devolve mensagens longas em inglês. Traduzir aqui evita espalhar
 * tratamento de erro pela UI — e o texto de cota é preservado, porque é a única
 * informação real que o Google dá sobre o limite da chave.
 */
function traduzirErro(err: unknown): Error {
  const original = err instanceof Error ? err : new Error(String(err));
  const texto = original.message ?? '';

  if (/RESOURCE_EXHAUSTED|429|quota/i.test(texto)) {
    return new ErroCotaIA(texto);
  }
  if (/API key|API_KEY_INVALID|401|403|PERMISSION_DENIED/i.test(texto)) {
    return new Error('A chave da IA foi recusada pelo Google. Avise o administrador.');
  }
  if (/abort/i.test(texto)) {
    return new Error('Geração interrompida.');
  }
  if (/MALFORMED_FUNCTION_CALL/i.test(texto)) {
    return new Error('O modelo montou uma chamada inválida. Tente reformular o pedido.');
  }
  if (/fetch|network|Failed to fetch/i.test(texto)) {
    return new Error('Não foi possível falar com o serviço de IA. Verifique sua conexão.');
  }
  return original;
}
