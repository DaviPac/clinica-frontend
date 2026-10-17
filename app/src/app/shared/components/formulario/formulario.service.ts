import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DialogoService } from '../../../core/services/dialogo/dialogo.service';
import { ItemFormulario, ValorFormulario } from './campos';
import { DadosFormularioDialogo, FormularioDialogoComponent } from './formulario-dialogo.component';
import { OpcoesFormulario, ResultadoFormulario } from './formulario.model';

/**
 * Formulário em diálogo, montado a partir de uma lista de campos — sem
 * `@if (modalAberto())`, sem template e sem componente de cadastro.
 *
 *   this.formulario.abrir({
 *     titulo: 'Nova despesa',
 *     tamanho: 'pequeno',
 *     campos: [
 *       new CampoTexto({ chave: 'descricao', rotulo: 'Descrição', obrigatorio: true }),
 *       new CampoNumero({ chave: 'valor', rotulo: 'Valor (R$)', obrigatorio: true, minimo: 0.01, passo: 0.01, largura: 'metade' }),
 *       new CampoData({ chave: 'data_vencimento', rotulo: 'Vencimento', obrigatorio: true, largura: 'metade' }),
 *       new CampoSelecao({ chave: 'categoria', rotulo: 'Categoria', opcoes: [
 *         { valor: 'FIXA', rotulo: 'Fixa' },
 *         { valor: 'VARIAVEL', rotulo: 'Variável' },
 *       ] }),
 *     ],
 *     botoes: { confirmar: 'Criar despesa' },
 *     aoConfirmar: valor => this.service.criarDespesa(valor),
 *   }).subscribe(r => { if (r) this.carregar(); });
 *
 * `valor` chega tipado a partir dos campos. O diálogo abre na hora da
 * chamada; o Observable emite uma vez ao fechar: `{ valor, resposta }` se
 * enviou, `undefined` se cancelou. As opções são as mesmas do
 * `<app-formulario>` (veja `DefinicaoFormulario`), mais título e tamanho.
 */
@Injectable({ providedIn: 'root' })
export class FormularioService {
  private readonly dialogo = inject(DialogoService);

  abrir<const C extends readonly ItemFormulario[], R = unknown>(
    opcoes: OpcoesFormulario<C, R>,
  ): Observable<ResultadoFormulario<ValorFormulario<C>, R> | undefined> {
    const { titulo, tamanho, ...definicao } = opcoes;
    const dados: DadosFormularioDialogo = { titulo, definicao };

    return this.dialogo.abrir<ResultadoFormulario<ValorFormulario<C>, R>>(FormularioDialogoComponent, {
      dados,
      tamanho,
      rotulo: titulo,
    }).closed;
  }
}
