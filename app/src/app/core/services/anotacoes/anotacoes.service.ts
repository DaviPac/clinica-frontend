import { Injectable } from '@angular/core';
import { DocumentoAgendamentoService } from '../documento/documento-agendamento.service';

/**
 * Anotações de um agendamento: o mesmo documento do prontuário, mas sem
 * histórico — cada salvamento substitui a única versão.
 */
@Injectable({ providedIn: 'root' })
export class AnotacoesService extends DocumentoAgendamentoService {
  constructor() {
    super('anotacoes', 'NotesNotFound');
  }
}
