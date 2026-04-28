import {
  Component, OnInit, signal, computed,
  inject, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { AuthService } from '../../core/services/auth/auth.service';
import { AgendamentoService, AgendamentoDto } from '../../core/services/agendamento/agendamento.service';
import { PacienteService, CriarPacienteDto } from '../../core/services/paciente/paciente.service';
import { ServicoService } from '../../core/services/servico/servico.service';
import { FinanceiroService, AcertoDto } from '../../core/services/financeiro/financeiro.service';
import { UsuarioService } from '../../core/services/usuario/usuario.service';
import { GeminiService } from '../../core/services/gemini/gemini.service';

import { Agendamento, StatusAgendamento } from '../../core/models/agendamento.model';
import { Paciente } from '../../core/models/paciente.model';
import { Servico } from '../../core/models/servico.model';
import { Usuario } from '../../core/models/usuario.model';

import { firstValueFrom } from 'rxjs';

// ─── Tool definitions ────────────────────────────────────────────────────────

export type ToolName =
  | 'listar_agendamentos'
  | 'listar_pendentes'
  | 'criar_agendamento'
  | 'atualizar_status_agendamento'
  | 'atualizar_pagamento_agendamento'
  | 'cancelar_recorrencia'
  | 'listar_pacientes'
  | 'criar_paciente'
  | 'listar_servicos'
  | 'get_saldo_a_receber'
  | 'get_relatorio_financeiro'
  | 'criar_despesa'
  | 'pagar_despesa'
  | 'criar_acerto'
  | 'listar_usuarios';

export interface PendingAction {
  tool: ToolName;
  args: Record<string, any>;
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  pendingAction?: PendingAction;
  confirmed?: boolean;
  loading?: boolean;
  timestamp: Date;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('inputRef') private inputRef!: ElementRef;

  private auth = inject(AuthService);
  private agendamentoSvc = inject(AgendamentoService);
  private pacienteSvc = inject(PacienteService);
  private servicoSvc = inject(ServicoService);
  private financeiroSvc = inject(FinanceiroService);
  private usuarioSvc = inject(UsuarioService);
  private geminiSvc = inject(GeminiService);

  readonly usuario = this.auth.usuario;
  readonly isAdmin = this.auth.isAdmin;
  readonly isProfissional = this.auth.isProfissional;

  private apiKey = signal("");

  // Mantidos os signals exigidos
  messages = signal<ChatMessage[]>([]);
  inputText = signal('');
  isLoading = signal(false);
  isOpen = signal(false);
  private shouldScroll = false;

  // Cached context data transformados em signals para usar no template
  pacientes = signal<Paciente[]>([]);
  servicos = signal<Servico[]>([]);
  usuariosLista = signal<Usuario[]>([]);
  agendamentos = signal<Agendamento[]>([]);

  // Tool definitions sent to AI
  private readonly TOOLS = this.buildToolDefinitions();

  ngOnInit() {
    this.geminiSvc.obterApiKey().subscribe(key => {
      this.apiKey.set(key.api_key);
    });
    this.loadInitialContext();
    this.addSystemWelcome();
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  // Métodos de UI mantidos exigidos pelo template
  toggleChat() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      setTimeout(() => this.inputRef?.nativeElement?.focus(), 100);
    }
  }

  async sendMessage() {
    const text = this.inputText().trim();
    if (!text || this.isLoading()) return;

    this.inputText.set('');
    this.addMessage({ role: 'user', content: text, timestamp: new Date() });
    await this.callAI(text);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ─── Confirmation flow ─────────────────────────────────────────────────────

  async confirmAction(msg: ChatMessage) {
    if (!msg.pendingAction) return;
    msg.confirmed = true;
    msg.loading = true;
    this.messages.update(msgs => [...msgs]); 

    try {
      // 1. Executa a ação na API
      const result = await this.executeTool(msg.pendingAction.tool, msg.pendingAction.args);
      const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

      // 2. RECARREGA OS DADOS PARA ATUALIZAR OS SIGNALS ANTES DA IA RESPONDER
      await this.loadInitialContext();

      // 3. Chama a IA repassando o resultado (agora com o contexto atualizado incluindo o novo dado)
      await this.callAIWithResult(
        `Ação executada com sucesso. Resultado: ${resultStr}. Confirme ao usuário de forma amigável.`
      );
    } catch (err: any) {
      this.addMessage({
        role: 'assistant',
        content: `Ocorreu um erro ao executar a ação: ${err?.message ?? 'Erro desconhecido'}. Por favor, tente novamente.`,
        timestamp: new Date()
      });
    } finally {
      msg.loading = false;
      this.messages.update(msgs => [...msgs]);
    }
  }

  cancelAction(msg: ChatMessage) {
    msg.confirmed = false;
    this.addMessage({
      role: 'assistant',
      content: 'Tudo bem, ação cancelada. Posso ajudar com mais alguma coisa?',
      timestamp: new Date()
    });
  }

  // ─── AI Call ───────────────────────────────────────────────────────────────

  private async callAI(userMessage: string) {
    this.isLoading.set(true);
    const loadingMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      loading: true,
      timestamp: new Date()
    };
    this.addMessage(loadingMsg);

    try {
      const contextBlock = await this.buildContextBlock();
      const systemPrompt = this.buildSystemPrompt(contextBlock);

      const history = this.messages()
        .filter(m => !m.loading && m.role !== 'system')
        .slice(-20)
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

      const response = await this.callGemini(systemPrompt, history, userMessage);
      this.removeLoadingMessage();
      this.processAIResponse(response);
    } catch (err: any) {
      this.removeLoadingMessage();
      console.error(err);
      this.addMessage({
        role: 'assistant',
        content: `Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.`,
        timestamp: new Date()
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  private async callAIWithResult(resultMessage: string) {
    const contextBlock = await this.buildContextBlock();
    const systemPrompt = this.buildSystemPrompt(contextBlock);

    const history = this.messages()
      .filter(m => !m.loading && m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

    const response = await this.callGemini(systemPrompt, history, resultMessage);
    this.processAIResponse(response);
  }

  private async callGemini(
    systemPrompt: string,
    history: { role: string; content: string }[],
    newMessage: string
  ): Promise<string> {
    const apiKey = this.apiKey();
    if (!apiKey) throw new Error('API Key do Gemini não encontrada');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: systemPrompt
    });

    const contents = history.map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }]
    }));
    
    contents.push({ role: 'user', parts: [{ text: newMessage }] });

    const result = await model.generateContent({ contents });
    return result.response.text();
  }

  // ─── Response processing ───────────────────────────────────────────────────

  private processAIResponse(raw: string) {
    const toolCallMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    if (toolCallMatch) {
      try {
        const parsed = JSON.parse(toolCallMatch[1]);
        if (parsed.tool && parsed.args && parsed.description) {
          const textBefore = raw.slice(0, raw.indexOf('```json')).trim();
          if (textBefore) {
            this.addMessage({ role: 'assistant', content: textBefore, timestamp: new Date() });
          }
          this.addMessage({
            role: 'assistant',
            content: parsed.description,
            pendingAction: { tool: parsed.tool, args: parsed.args, description: parsed.description },
            timestamp: new Date()
          });
          return;
        }
      } catch { /* not JSON, fall through */ }
    }
    this.addMessage({ role: 'assistant', content: raw, timestamp: new Date() });
  }

  // ─── Tool execution ────────────────────────────────────────────────────────

  private executeTool(tool: ToolName, args: Record<string, any>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      switch (tool) {
        case 'listar_agendamentos':
          this.agendamentoSvc.listar(args['de'] as string, args['ate'] as string, this.isAdmin())
            .subscribe({ next: resolve, error: reject });
          break;
        case 'listar_pendentes':
          this.agendamentoSvc.listarPendentes(this.isAdmin())
            .subscribe({ next: resolve, error: reject });
          break;
        case 'criar_agendamento':
          this.agendamentoSvc.criar(args as unknown as AgendamentoDto)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'atualizar_status_agendamento':
          // Atualizado de args['id'] para args['agendamento_id']
          this.agendamentoSvc.atualizarStatus(args['agendamento_id'] as number, args['status'] as StatusAgendamento)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'atualizar_pagamento_agendamento':
          // Atualizado de args['id'] para args['agendamento_id']
          this.agendamentoSvc.atualizarPagamento(args['agendamento_id'] as number, args['pago'] as boolean)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'cancelar_recorrencia':
          this.agendamentoSvc.cancelarRecorrencia(args['group_id'] as string)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'listar_pacientes':
          this.pacienteSvc.listar()
            .subscribe({ next: resolve, error: reject });
          break;
        case 'criar_paciente':
          this.pacienteSvc.criar(args as unknown as CriarPacienteDto)
            .subscribe({ next: r => resolve(r.body), error: reject });
          break;
        case 'listar_servicos':
          this.servicoSvc.listar()
            .subscribe({ next: resolve, error: reject });
          break;
        case 'get_saldo_a_receber':
          this.financeiroSvc.getSaldoAReceber(args['periodo'] as string)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'get_relatorio_financeiro':
          this.financeiroSvc.getRelatorio(args['periodo'] as string)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'criar_despesa':
          this.financeiroSvc.criarDespesa(args as any)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'pagar_despesa':
          this.financeiroSvc.pagarDespesa(args['despesa_id'] as number)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'criar_acerto':
          this.financeiroSvc.criarAcerto(args as unknown as AcertoDto)
            .subscribe({ next: resolve, error: reject });
          break;
        case 'listar_usuarios':
          if (!this.isAdmin()) { reject(new Error('Acesso negado')); return; }
          this.usuarioSvc.listar()
            .subscribe({ next: resolve, error: reject });
          break;
        default:
          reject(new Error(`Ferramenta desconhecida: ${tool}`));
      }
    });
  }

  // ─── Context building ──────────────────────────────────────────────────────

  private async loadInitialContext() {
    try {
      const p = await firstValueFrom(this.pacienteSvc.listar());
      this.pacientes.set(p);

      const s = await firstValueFrom(this.servicoSvc.listar());
      this.servicos.set(s);

      if (this.isAdmin()) {
        const u = await firstValueFrom(this.usuarioSvc.listar());
        this.usuariosLista.set(u);
      }

      const hoje = new Date();
      const de = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
      const ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const a = await firstValueFrom(this.agendamentoSvc.listar(de, ate));
      this.agendamentos.set(a);
    } catch (error) {
      console.error('Erro ao recarregar o contexto da clínica:', error);
    }
  }

  private async buildContextBlock(): Promise<string> {
    const u = this.usuario();
    
    const agora = new Date();
    const tzOffset = -agora.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = (num: number) => num.toString().padStart(2, '0');
    const offsetString = `${diff}${pad(Math.floor(Math.abs(tzOffset) / 60))}:${pad(Math.abs(tzOffset) % 60)}`;
    const dataHoraReferencia = agora.getFullYear() +
      '-' + pad(agora.getMonth() + 1) +
      '-' + pad(agora.getDate()) +
      'T' + pad(agora.getHours()) +
      ':' + pad(agora.getMinutes()) +
      ':' + pad(agora.getSeconds()) +
      offsetString;
    
    let ctx = `Data/hora atual de referência: ${dataHoraReferencia} (Use este formato e fuso horário para calcular datas)\n`;
    ctx += `Usuário logado: ${u?.nome} (${u?.role}, ID: ${u?.id})\n\n`;
    
    const listaPacientes = this.pacientes().map(p => `- ${p.nome} (ID: ${p.id})`).join('\n');
    ctx += `Pacientes cadastrados (${this.pacientes().length}):\n${listaPacientes}\n\n`;
    
    const listaServicos = this.servicos().map(s => 
      `- ${s.nome} (ID: ${s.id}, R$ ${s.valor_atual}, Pacote: ${s.is_pacote ? 'SIM' : 'NÃO'})`
    ).join('\n');
    ctx += `Serviços disponíveis:\n${listaServicos}\n\n`;
    
    // Incluir agendamentos ativos pode ajudar a IA a referenciar os IDs corretos
    const listaAgendamentos = this.agendamentos()
      .map(a => `- Agendamento ID: ${a.id} | Paciente ID: ${a.paciente_id} | Data: ${a.data_hora_inicio} | Status: ${a.status}`)
      .join('\n');
    ctx += `Agendamentos recentes neste mês:\n${listaAgendamentos}\n\n`;
    
    if (this.isAdmin() && this.usuariosLista().length) {
      ctx += `Profissionais:\n${this.usuariosLista().filter(user => user.role === 'PROFISSIONAL').map(user => `- ${user.nome} (ID: ${user.id})`).join('\n')}\n`;
    }
    
    return ctx;
  }

  private buildSystemPrompt(context: string): string {
    const isAdmin = this.isAdmin();
    const u = this.usuario();

    return `Você é um assistente inteligente integrado ao sistema de gestão de clínica de saúde.
Você pode consultar informações e realizar operações no sistema em nome do usuário.

CONTEXTO DO SISTEMA:
${context}

PERMISSÕES DO USUÁRIO (${u?.role}):
${isAdmin
  ? '- Acesso total: agendamentos, pacientes, serviços, financeiro, usuários, relatórios, despesas, acertos.'
  : '- Acesso restrito: apenas seus próprios agendamentos, seus pacientes, seus serviços, seu saldo financeiro. NÃO pode ver dados de outros profissionais, lista de usuários, relatórios gerais ou acertos de outros.'}

INSTRUÇÕES:
1. Responda sempre em português brasileiro, de forma clara e amigável.
2. Quando o usuário pedir uma OPERAÇÃO DE ESCRITA (criar, atualizar, cancelar, pagar), você DEVE solicitar confirmação antes de executar.
3. Para solicitar confirmação, retorne a resposta com um bloco JSON no seguinte formato EXATO:
\`\`\`json
{
  "tool": "<nome_da_ferramenta>",
  "args": { <argumentos_em_json> },
  "description": "<descrição clara em português do que será feito, incluindo todos os detalhes relevantes>"
}
\`\`\`
4. Para operações de LEITURA, execute diretamente e apresente os dados formatados.
5. EXTREMAMENTE IMPORTANTE: Nunca confunda IDs. Se a ferramenta pedir 'agendamento_id', você DEVE buscar o ID na lista de Agendamentos (Agendamento ID), não o ID do Paciente. Nunca deduz o ID do agendamento olhando para o paciente.
6. EXTREMAMENTE IMPORTANTE SOBRE PACOTES E RECORRÊNCIA: Se for criar um agendamento e o serviço selecionado constar no contexto como "Pacote: SIM", preencha "pacote": true e "recorrente": true na ferramenta criar_agendamento. Peça ao usuário o "total_sessoes" caso não consiga deduzir.
7. REGRA ESTRITA DE DATA/HORA: Formate como "YYYY-MM-DDTHH:mm:ss-03:00".
8. Se não tiver informações suficientes para uma operação, pergunte antes de gerar o JSON de confirmação.

FERRAMENTAS DISPONÍVEIS:
${JSON.stringify(this.TOOLS, null, 2)}`;
  }

  // ─── Tool definitions ──────────────────────────────────────────────────────

  private buildToolDefinitions() {
    const isAdmin = this.auth.isAdmin();
    const tools: any[] = [
      { name: 'listar_agendamentos', description: 'Lista agendamentos por período', params: { de: 'string (YYYY-MM-DD)', ate: 'string (YYYY-MM-DD)' } },
      { name: 'listar_pendentes', description: 'Lista agendamentos com status AGENDADO pendentes', params: {} },
      { name: 'criar_agendamento', description: 'Cria um novo agendamento.', params: { paciente_id: 'number', servico_id: 'number', data_hora_inicio: 'string RFC3339', duracao_minutos: 'number', valor_combinado: 'number', recorrente: 'boolean', total_sessoes: 'number', pacote: 'boolean' } },
      // Alterado id para agendamento_id para forçar consistência semântica na IA
      { name: 'atualizar_status_agendamento', description: 'Atualiza status de um agendamento existente', params: { agendamento_id: 'number', status: 'AGENDADO|REALIZADO|FALTA|CANCELADO' } },
      { name: 'atualizar_pagamento_agendamento', description: 'Marca um agendamento específico como pago', params: { agendamento_id: 'number', pago: 'boolean' } },
      { name: 'cancelar_recorrencia', description: 'Cancela todos os agendamentos de uma recorrência', params: { group_id: 'string' } },
      { name: 'listar_pacientes', description: 'Lista pacientes', params: {} },
      { name: 'criar_paciente', description: 'Cria um novo paciente', params: { nome: 'string', cpf: 'string?', telefone: 'string?', data_nascimento: 'string? (YYYY-MM-DD)' } },
      { name: 'listar_servicos', description: 'Lista serviços disponíveis', params: {} },
      { name: 'get_saldo_a_receber', description: 'Consulta saldo a receber do profissional', params: { periodo: 'string? (YYYY-MM)' } },
    ];

    if (isAdmin) {
      tools.push(
        { name: 'get_relatorio_financeiro', description: 'Relatório financeiro geral (admin)', params: { periodo: 'string? (YYYY-MM)' } },
        { name: 'criar_despesa', description: 'Cria uma despesa da clínica (admin)', params: { descricao: 'string', valor: 'number', data_vencimento: 'string', categoria: 'FIXA|VARIAVEL' } },
        { name: 'pagar_despesa', description: 'Marca uma despesa como paga (admin)', params: { despesa_id: 'number' } },
        { name: 'criar_acerto', description: 'Registra acerto de comissão com profissional (admin)', params: { profissional_id: 'number', periodo_referencia: 'string', valor_pago: 'number', observacao: 'string?' } },
        { name: 'listar_usuarios', description: 'Lista todos os usuários (admin)', params: {} },
      );
    }

    return tools;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private addSystemWelcome() {
    const u = this.usuario();
    this.addMessage({
      role: 'assistant',
      content: `Olá, **${u?.nome ?? 'profissional'}**! 👋\n\nSou seu assistente da clínica. Posso ajudá-lo a:\n\n- 📅 Consultar e criar agendamentos\n- 👤 Gerenciar pacientes\n- 💰 Verificar pagamentos e saldo\n${this.isAdmin() ? '- 📊 Relatórios financeiros e gestão de equipe\n' : ''}\nComo posso ajudar hoje?`,
      timestamp: new Date()
    });
  }

  private addMessage(msg: ChatMessage) {
    this.messages.update(msgs => [...msgs, msg]);
    this.shouldScroll = true;
  }

  private removeLoadingMessage() {
    this.messages.update(msgs => msgs.filter(m => !m.loading));
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch { }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  trackByIndex(index: number): number {
    return index;
  }

  // Novo Helper para usar ngModel com chaves genéricas caso necessário
  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }
}