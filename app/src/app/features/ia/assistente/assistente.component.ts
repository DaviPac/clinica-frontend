import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CatalogoService } from '../../../core/ia/catalogo.service';
import { AgenteIaService } from '../../../core/ia/agente/agente-ia.service';
import { ModelosService } from '../../../core/ia/gemini/modelos.service';
import { NivelRaciocinio } from '../../../core/ia/ia.config';
import {
  Mensagem,
  MensagemFerramenta,
  MensagemTexto,
  USO_ZERADO,
} from '../../../core/ia/models/chat.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { semanaAtual } from '../../../core/utils/data.utils';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { ChatComposerComponent } from '../components/chat-composer/chat-composer.component';
import { ConversasSidebarComponent } from '../components/conversas-sidebar/conversas-sidebar.component';
import { FerramentaCardComponent } from '../components/ferramenta-card/ferramenta-card.component';
import { MensagemChatComponent } from '../components/mensagem-chat/mensagem-chat.component';
import { PainelUsoComponent } from '../components/painel-uso/painel-uso.component';
import { SeletorModeloComponent } from '../components/seletor-modelo/seletor-modelo.component';

@Component({
  selector: 'app-assistente',
  standalone: true,
  imports: [
    AlertComponent,
    ChatComposerComponent,
    ConversasSidebarComponent,
    FerramentaCardComponent,
    MensagemChatComponent,
    PainelUsoComponent,
    SeletorModeloComponent,
  ],
  // A página é dona do próprio scroll: o <main> do shell já rola, então sem
  // h-full/min-h-0 aqui o composer flutuaria no meio do documento.
  host: { class: 'flex h-full min-h-0' },
  templateUrl: './assistente.component.html',
})
export class AssistenteComponent implements OnInit {
  readonly agente = inject(AgenteIaService);
  private readonly auth = inject(AuthService);
  private readonly modelos = inject(ModelosService);
  private readonly catalogo = inject(CatalogoService);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly sidebarAberta = signal(false);
  readonly primeiroNome = computed(
    () => this.auth.usuario()?.nome?.split(' ')[0] ?? 'por aqui',
  );

  readonly conversaAtual = this.agente.conversa;
  readonly mensagens = this.agente.mensagens;
  readonly vazio = computed(() => this.mensagens().length === 0);
  readonly uso = computed(() => this.conversaAtual()?.uso ?? USO_ZERADO);

  readonly sugestoes = computed(() => {
    const { de, ate } = semanaAtual();
    const base = [
      `Quais agendamentos tenho entre ${formatarBr(de)} e ${formatarBr(ate)}?`,
      'Quais pacientes estão com pagamento pendente?',
      'Qual é o meu saldo a receber deste mês?',
    ];
    return this.auth.isAdmin()
      ? [...base.slice(0, 2), 'Como está o relatório financeiro deste mês?', 'Quais despesas estão em aberto?']
      : [...base, 'Quais agendamentos ainda não foram confirmados?'];
  });

  /** Só rola sozinho se o usuário já estava no fim — não sequestra a leitura. */
  private coladoNoFim = true;

  constructor() {
    effect(() => {
      this.mensagens();
      this.agente.rotuloEstado();
      if (!this.coladoNoFim) return;
      queueMicrotask(() => this.rolarParaFim());
    });
  }

  async ngOnInit(): Promise<void> {
    this.sidebarAberta.set(window.innerWidth >= 1024);

    await this.agente.carregarLista();
    const primeira = this.agente.conversas()[0];
    if (primeira) {
      await this.agente.abrir(primeira.id);
    } else {
      await this.agente.novaConversa();
    }

    void this.modelos.carregar();
    void this.catalogo.garantirCarregado();
  }

  /**
   * Abaixo de lg a lista de conversas é uma gaveta sobre o conteúdo; deixá-la
   * aberta ao encolher a janela esconderia o chat inteiro.
   */
  @HostListener('window:resize')
  aoRedimensionar(): void {
    if (window.innerWidth < 1024) this.sidebarAberta.set(false);
  }

  // ── Interações ─────────────────────────────────────────────────────────────

  async novaConversa(): Promise<void> {
    await this.agente.novaConversa();
    this.fecharSidebarNoMobile();
  }

  async selecionar(id: string): Promise<void> {
    await this.agente.abrir(id);
    this.coladoNoFim = true;
    this.fecharSidebarNoMobile();
  }

  async renomear(evento: { id: string; titulo: string }): Promise<void> {
    await this.agente.renomear(evento.id, evento.titulo);
  }

  async remover(id: string): Promise<void> {
    await this.agente.remover(id);
    const proxima = this.agente.conversas()[0];
    if (proxima) await this.agente.abrir(proxima.id);
    else await this.agente.novaConversa();
  }

  async enviar(texto: string): Promise<void> {
    this.coladoNoFim = true;
    await this.agente.enviar(texto);
    await this.catalogo.recarregar();
  }

  async confirmar(mensagemId: string, args: Record<string, unknown>): Promise<void> {
    await this.agente.confirmarFerramenta(mensagemId, args);
    await this.catalogo.recarregar();
  }

  async cancelar(mensagemId: string): Promise<void> {
    await this.agente.cancelarFerramenta(mensagemId);
  }

  async trocarModelo(id: string): Promise<void> {
    await this.agente.definirModelo(id);
  }

  async trocarRaciocinio(nivel: NivelRaciocinio): Promise<void> {
    await this.agente.definirRaciocinio(nivel);
  }

  // ── Auxiliares de template ─────────────────────────────────────────────────

  comoTexto(m: Mensagem): MensagemTexto {
    return m as MensagemTexto;
  }

  comoFerramenta(m: Mensagem): MensagemFerramenta {
    return m as MensagemFerramenta;
  }

  aoRolar(evento: Event): void {
    const el = evento.target as HTMLElement;
    const distanciaDoFim = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.coladoNoFim = distanciaDoFim < 80;
  }

  private rolarParaFim(): void {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private fecharSidebarNoMobile(): void {
    if (window.innerWidth < 1024) this.sidebarAberta.set(false);
  }
}

function formatarBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
