import { Component, input } from '@angular/core';

/**
 * Cabeçalho de tela: título, linha de apoio e espaço para as ações.
 * Empilha no mobile e alinha em linha a partir de 640px.
 *
 *   <app-cabecalho-pagina titulo="Pacientes" [subtitulo]="total() + ' encontrados'">
 *     <button appBotao>+ Novo paciente</button>
 *   </app-cabecalho-pagina>
 */
@Component({
  selector: 'app-cabecalho-pagina',
  standalone: true,
  templateUrl: './cabecalho-pagina.component.html',
  styleUrl: './cabecalho-pagina.component.css',
})
export class CabecalhoPaginaComponent {
  titulo = input('');
  subtitulo = input('');
}
