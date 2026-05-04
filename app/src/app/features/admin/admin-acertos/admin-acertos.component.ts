import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { FinanceiroService, AcertoDto, RelatorioFinanceiro } from '../../../core/services/financeiro/financeiro.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { AcertoComissao } from '../../../core/models/financeiro.model';
import { Usuario } from '../../../core/models/usuario.model';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';

interface AcertoEnriquecido extends AcertoComissao {
  nome_profissional: string;
}

// Interface para controlar o estado do modal
interface RepasseSelecionado {
  profissionalId: number;
  valor: number;
  nome: string;
}

@Component({
  selector: 'app-admin-acertos',
  standalone: true,
  imports: [CommonModule, ToggleComponent],
  templateUrl: './admin-acertos.component.html',
})
export class AdminAcertosComponent implements OnInit {
  private usuarios = signal<Usuario[]>([]);
  
  // Sinais de estado
  profissionaisPendentes = signal<RelatorioFinanceiro['profissionais']>([]);
  historicoAcertos = signal<AcertoEnriquecido[]>([]);

  mostrarHistorico = signal(false);
  processando = signal<number | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  // Estado do modal de confirmação
  repasseSelecionado = signal<RepasseSelecionado | null>(null);

  // Define o período atual (ex: "2026-04")
  periodoSelecionado = signal(this.obterPeriodoAtual());

  totalPendente = computed(() =>
    this.profissionaisPendentes().reduce((s, p) => s + p.pendente, 0)
  );

  constructor(
    private financeiroService: FinanceiroService,
    private usuarioService: UsuarioService,
  ) {}

  ngOnInit() {
    this.carregarDados();
  }

  carregarDados() {
    this.carregando.set(true);
    this.erro.set(null);

    forkJoin({
      usuarios: this.usuarioService.listar(),
      relatorio: this.financeiroService.getRelatorio(this.periodoSelecionado()),
      acertos: this.financeiroService.getAcertos()
    }).subscribe({
      next: ({ usuarios, relatorio, acertos }) => {
        this.usuarios.set(usuarios);

        const isAdmin = (p: {
            profissional_id: number;
            nome_profissional: string;
            total_recebido: number;
            comissao_clinica: number;
            a_receber: number;
            total_repassado: number;
            pendente: number;
        }) => usuarios.find(u => u.id == p.profissional_id && u.role == 'ADMIN')
        const pendentes = relatorio.profissionais.filter(p => p.pendente > 0 && !isAdmin(p));
        this.profissionaisPendentes.set(pendentes);

        const enriquecidos = acertos
          .map(a => ({
            ...a,
            nome_profissional: this.nomeDoUsuario(a.profissional_id),
          }))
          .sort((a, b) => new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime());
        
        this.historicoAcertos.set(enriquecidos);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message || 'Erro ao carregar dados financeiros.');
        this.carregando.set(false);
      },
    });
  }

  // Prepara os dados e abre o modal
  iniciarRepasse(profissionalId: number, valorPendente: number, nome: string) {
    this.repasseSelecionado.set({
      profissionalId,
      valor: valorPendente,
      nome
    });
  }

  // Fecha o modal
  cancelarRepasse() {
    this.repasseSelecionado.set(null);
  }

  // Executa o repasse após confirmação
  confirmarRepasse() {
    const selecionado = this.repasseSelecionado();
    if (!selecionado) return;

    this.processando.set(selecionado.profissionalId);
    this.erro.set(null);
    this.repasseSelecionado.set(null); // Fecha o modal imediatamente

    const dto: AcertoDto = {
      profissional_id: selecionado.profissionalId,
      periodo_referencia: this.periodoSelecionado(),
      valor_pago: selecionado.valor,
      observacao: 'Repasse processado pela clínica',
    };

    this.financeiroService.criarAcerto(dto).subscribe({
      next: () => {
        this.processando.set(null);
        this.carregarDados(); 
      },
      error: (err: Error) => {
        this.erro.set(err.message || 'Erro ao registrar o repasse.');
        this.processando.set(null);
      },
    });
  }

  private nomeDoUsuario(id: number): string {
    return this.usuarios().find(u => u.id === id)?.nome ?? `Profissional #${id}`;
  }

  private obterPeriodoAtual(): string {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  }

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  formatarMes(yyyyMM: string): string {
    const [ano, mes] = yyyyMM.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun',
                   'Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[+mes - 1]} ${ano}`;
  }

  onPeriodoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.periodoSelecionado.set(input.value);
      this.carregarDados();
    }
  }
}