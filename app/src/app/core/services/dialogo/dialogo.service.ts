import { Injectable, Injector, effect, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay, PositionStrategy } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { filter } from 'rxjs/operators';
import { ViewportService } from '../viewport/viewport.service';

export type TamanhoDialogo = 'pequeno' | 'medio' | 'grande';

export interface OpcoesDialogo<D> {
  /** Chega no componente aberto via `inject(DIALOG_DATA)`. */
  dados?: D;
  tamanho?: TamanhoDialogo;
  /**
   * Impede fechar por Esc ou clique no fundo. Para travar só durante um
   * salvamento, o próprio componente pode alternar `dialogRef.disableClose`.
   */
  bloquearFechamento?: boolean;
  /** Fecha quando o router navega para outra tela. Padrão: true. */
  fecharAoNavegar?: boolean;
  /** Nome acessível do diálogo, lido por leitores de tela. */
  rotulo?: string;
}

const LARGURAS: Record<TamanhoDialogo, string> = {
  pequeno: '24rem',
  medio: '28rem',
  grande: '40rem',
};

/**
 * Abre componentes como diálogo, de forma imperativa.
 *
 *   const ref = this.dialogo.abrir(ServicosModalComponent, { dados: servico });
 *   ref.closed.subscribe(salvo => { if (salvo) this.carregar(); });
 *
 * Dentro do componente aberto:
 *
 *   dados = inject<Servico>(DIALOG_DATA);
 *   ref = inject<DialogRef<boolean>>(DialogRef);
 *   ...
 *   this.ref.close(true);
 *
 * O visual (caixa, título, ×) fica com o `<app-dialogo>`; este serviço só
 * cuida de posição, fundo, foco, Esc e ciclo de vida. Como no `<app-modal>`,
 * é uma caixa centralizada no desktop e um bottom sheet abaixo de 640px —
 * e troca sozinho se a janela cruzar o corte com o diálogo aberto.
 */
@Injectable({ providedIn: 'root' })
export class DialogoService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly router = inject(Router);
  private readonly viewport = inject(ViewportService);
  private readonly injector = inject(Injector);

  abrir<R = unknown, D = unknown, C = unknown>(
    componente: ComponentType<C>,
    opcoes: OpcoesDialogo<D> = {},
  ): DialogRef<R, C> {
    const largura = LARGURAS[opcoes.tamanho ?? 'medio'];
    const mobile = this.viewport.isMobile();

    const ref = this.dialog.open<R, D, C>(componente, {
      data: opcoes.dados,
      width: '100%',
      maxWidth: mobile ? '100%' : largura,
      disableClose: opcoes.bloquearFechamento ?? false,
      ariaLabel: opcoes.rotulo ?? null,
      panelClass: 'dialogo-painel',
      backdropClass: 'dialogo-fundo',
      positionStrategy: this.posicao(mobile),
    });

    const acompanharViewport = effect(() => {
      const mobile = this.viewport.isMobile();
      ref.overlayRef.updateSize({ maxWidth: mobile ? '100%' : largura });
      ref.overlayRef.updatePositionStrategy(this.posicao(mobile));
    }, { injector: this.injector, manualCleanup: true });

    const navegacao = (opcoes.fecharAoNavegar ?? true)
      ? this.router.events
          .pipe(filter(e => e instanceof NavigationStart))
          .subscribe(() => ref.close())
      : null;

    ref.closed.subscribe(() => {
      acompanharViewport.destroy();
      navegacao?.unsubscribe();
    });

    return ref;
  }

  /** Fecha todos os diálogos abertos — ex.: ao sair da sessão. */
  fecharTodos() {
    this.dialog.closeAll();
  }

  private posicao(mobile: boolean): PositionStrategy {
    const global = this.overlay.position().global().centerHorizontally();
    return mobile ? global.bottom('0') : global.centerVertically();
  }
}
