import { inject } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { AnotacoesService } from '../../../../core/services/anotacoes/anotacoes.service';
import { DocumentoAgendamentoService } from '../../../../core/services/documento/documento-agendamento.service';
import { ProntuarioService } from '../../../../core/services/prontuario/prontuario.service';

export type TipoDocumento = 'prontuario' | 'anotacoes';

/**
 * O prontuário e as anotações são o mesmo documento nas mesmas telas; o que
 * muda é o recurso na API, se há histórico e os textos (com o gênero e o
 * número certos — "o prontuário foi salvo", "as anotações foram salvas").
 */
export interface ConfigDocumento {
  tipo: TipoDocumento;
  /** Segmento da rota depois do agendamento: `/agendamentos/:id/<rota>`. */
  rota: string;
  titulo: string;
  /** Com artigo, para o meio das frases. */
  oNome: string;
  criar: string;
  naoCriado: string;
  carregando: string;
  salvoEmOutraGuia: string;
  placeholder: string;
  /** Cada salvamento vira uma versão consultável; sem isso, substitui a única que há. */
  historico: boolean;
  /** Início do nome dos arquivos exportados. */
  prefixoArquivo: string;
}

export const DOCUMENTOS: Record<TipoDocumento, ConfigDocumento> = {
  prontuario: {
    tipo: 'prontuario',
    rota: 'prontuario',
    titulo: 'Prontuário',
    oNome: 'o prontuário',
    criar: 'Criar prontuário',
    naoCriado: 'Prontuário ainda não criado',
    carregando: 'Carregando prontuário...',
    salvoEmOutraGuia: 'O prontuário foi salvo em outra guia.',
    placeholder: 'Comece a escrever o prontuário…',
    historico: true,
    prefixoArquivo: 'prontuario',
  },
  anotacoes: {
    tipo: 'anotacoes',
    rota: 'anotacoes',
    titulo: 'Anotações',
    oNome: 'as anotações',
    criar: 'Criar anotações',
    naoCriado: 'Anotações ainda não criadas',
    carregando: 'Carregando anotações...',
    salvoEmOutraGuia: 'As anotações foram salvas em outra guia.',
    placeholder: 'Comece a escrever as anotações…',
    historico: false,
    prefixoArquivo: 'anotacoes',
  },
};

/** O documento da tela vem do `data.documento` da rota; sem ele, é o prontuário. */
export function configDaRota(rota: ActivatedRouteSnapshot): ConfigDocumento {
  return DOCUMENTOS[(rota.data['documento'] as TipoDocumento | undefined) ?? 'prontuario'];
}

/** O serviço da API do documento. Precisa de contexto de injeção. */
export function injetarServicoDocumento(tipo: TipoDocumento): DocumentoAgendamentoService {
  return tipo === 'anotacoes' ? inject(AnotacoesService) : inject(ProntuarioService);
}
