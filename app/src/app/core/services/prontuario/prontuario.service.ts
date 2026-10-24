import { Injectable } from '@angular/core';
import { ProntuarioVersao, ProntuarioVersaoResumo } from '../../models/prontuario.model';
import { DocumentoAgendamentoService } from '../documento/documento-agendamento.service';

/**
 * Prontuário de um agendamento. Cada salvamento cria uma versão nova na API;
 * o GET devolve a atual e as anteriores ficam no histórico.
 */
@Injectable({ providedIn: 'root' })
export class ProntuarioService extends DocumentoAgendamentoService<ProntuarioVersao> {
  constructor() {
    super('prontuario', 'MedicalRecordNotFound');
  }

  listarVersoes(agendamentoId: number) {
    return this.http.get<ProntuarioVersaoResumo[]>(`${this.url(agendamentoId)}/versoes`);
  }

  obterVersao(agendamentoId: number, versaoId: number) {
    return this.http.get<ProntuarioVersao>(`${this.url(agendamentoId)}/versoes/${versaoId}`);
  }
}
