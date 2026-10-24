import { Component, input, output } from '@angular/core';
import { ProntuarioVersaoResumo } from '../../../core/models/prontuario.model';
import { formatarDataHora } from '../../../core/utils/data.utils';
import { CarregandoComponent } from '../../../shared/ui/carregando/carregando.component';

/**
 * Lista de versões do prontuário, da mais nova para a mais antiga. Só
 * apresentação: quem carrega e mostra a versão escolhida é a tela.
 */
@Component({
  selector: 'app-prontuario-historico',
  standalone: true,
  imports: [CarregandoComponent],
  templateUrl: './prontuario-historico.component.html',
  styleUrl: './prontuario-historico.component.css',
})
export class ProntuarioHistoricoComponent {
  readonly versoes = input.required<ProntuarioVersaoResumo[]>();
  readonly carregando = input(false);
  /** A versão que está na folha agora. */
  readonly exibidaId = input<number | null>(null);
  readonly desabilitado = input(false);

  readonly abrir = output<ProntuarioVersaoResumo>();

  formatarDataHora = formatarDataHora;
}
