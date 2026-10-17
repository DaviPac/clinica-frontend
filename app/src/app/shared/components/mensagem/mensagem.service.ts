import { Injectable, inject } from '@angular/core';
import { AsyncSubject, Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { DialogoService } from '../../../core/services/dialogo/dialogo.service';
import { MensagemComponent } from './mensagem.component';
import { DadosMensagem, OpcoesConfirmacao } from './mensagem.model';

/**
 * Mensagens e confirmações em diálogo, sem estado no componente que chama.
 *
 *   this.mensagem.erro('Não foi possível salvar.');
 *
 *   this.mensagem.confirmar({
 *     titulo: 'Desativar serviço',
 *     mensagem: `O serviço '${s.nome}' será desativado.`,
 *     variante: 'perigo',
 *     rotuloConfirmar: 'Desativar',
 *     aoConfirmar: () => this.service.desativar(s.id),
 *   }).subscribe(ok => { if (ok) this.carregar(); });
 *
 * A mensagem aparece na hora da chamada — não precisa de subscribe; o
 * Observable só serve para saber quando (e como) ela foi fechada.
 * Mensagens disparadas em sequência entram numa fila e aparecem uma por vez.
 * Ao contrário dos diálogos comuns, não fecham quando a rota muda: um
 * "salvo com sucesso" seguido de navegação continua visível.
 */
@Injectable({ providedIn: 'root' })
export class MensagemService {
  private readonly dialogo = inject(DialogoService);
  private fila: Promise<void> = Promise.resolve();

  info(mensagem: string, titulo?: string): Observable<void> {
    return this.notificar({ tipo: 'info', mensagem, titulo });
  }

  sucesso(mensagem: string, titulo?: string): Observable<void> {
    return this.notificar({ tipo: 'sucesso', mensagem, titulo });
  }

  aviso(mensagem: string, titulo?: string): Observable<void> {
    return this.notificar({ tipo: 'aviso', mensagem, titulo });
  }

  erro(mensagem: string, titulo?: string): Observable<void> {
    return this.notificar({ tipo: 'erro', mensagem, titulo });
  }

  /** Emite `true` se confirmou; `false` se cancelou, apertou Esc ou clicou fora. */
  confirmar(opcoes: OpcoesConfirmacao | string): Observable<boolean> {
    const dados = typeof opcoes === 'string' ? { mensagem: opcoes } : opcoes;
    return this.exibir({ tipo: 'confirmar', ...dados }).pipe(map(r => r === true));
  }

  private notificar(dados: DadosMensagem): Observable<void> {
    return this.exibir(dados).pipe(map(() => undefined));
  }

  private exibir(dados: DadosMensagem): Observable<boolean | undefined> {
    const resultado = new AsyncSubject<boolean | undefined>();

    this.fila = this.fila.then(async () => {
      try {
        const ref = this.dialogo.abrir<boolean>(MensagemComponent, {
          dados,
          tamanho: 'pequeno',
          fecharAoNavegar: false,
          rotulo: dados.titulo ?? dados.mensagem,
        });
        resultado.next(await firstValueFrom(ref.closed));
        resultado.complete();
      } catch (e) {
        // Não deixa uma falha travar a fila para as próximas mensagens.
        resultado.error(e);
      }
    });

    return resultado.asObservable();
  }
}
