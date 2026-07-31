import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceiroService, RelatorioFinanceiro } from '../../../core/services/financeiro/financeiro.service';

type Direcao = 'CLINICA_PAGA' | 'PROFISSIONAL_PAGA' | 'MISTO' | 'NENHUM';

type ProfissionalRelatorio = RelatorioFinanceiro['profissionais'][number];
type LinhaRelatorio = ProfissionalRelatorio & { direcao: Direcao };

@Component({
  selector: 'app-admin-relatorio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-relatorio.component.html',
})
export class AdminRelatorioComponent implements OnInit {
  relatorio = signal<RelatorioFinanceiro | null>(null);
  periodoSelecionado = signal(new Date().toISOString().slice(0, 7));
  carregando = signal(true);
  erro = signal<string | null>(null);

  linhas = computed<LinhaRelatorio[]>(() =>
    (this.relatorio()?.profissionais ?? []).map(p => ({ ...p, direcao: this.direcaoDe(p) }))
  );

  totalPendenteAoProfissional = computed(() =>
    this.linhas().reduce((s, l) => s + l.pendenteAoProfissional, 0)
  );

  totalPendenteAClinica = computed(() =>
    this.linhas().reduce((s, l) => s + l.pendenteAClinica, 0)
  );

  constructor(private service: FinanceiroService) {}

  ngOnInit() { this.carregar(); }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    this.service.getRelatorio(this.periodoSelecionado()).subscribe({
      next: r => { this.relatorio.set(r); this.carregando.set(false); },
      error: (err: Error) => { this.erro.set(err.message); this.carregando.set(false); },
    });
  }

  onPeriodoChange(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) { this.periodoSelecionado.set(valor); this.carregar(); }
  }

  private direcaoDe(p: ProfissionalRelatorio): Direcao {
    const paraProfissional = p.devidoAoProfissional > 0;
    const paraClinica = p.devidoAClinica > 0;
    if (paraProfissional && paraClinica) return 'MISTO';
    if (paraProfissional) return 'CLINICA_PAGA';
    if (paraClinica) return 'PROFISSIONAL_PAGA';
    return 'NENHUM';
  }

  rotuloDirecao(d: Direcao) {
    return {
      CLINICA_PAGA: 'Clínica recebe',
      PROFISSIONAL_PAGA: 'Profissional recebe',
      MISTO: 'Misto',
      NENHUM: '—',
    }[d];
  }

  classeDirecao(d: Direcao) {
    return {
      CLINICA_PAGA: 'bg-teal-50 text-teal-700 ring-1 ring-teal-100',
      PROFISSIONAL_PAGA: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
      MISTO: 'bg-purple-50 text-purple-700 ring-1 ring-purple-100',
      NENHUM: 'bg-gray-50 text-gray-400 ring-1 ring-gray-100',
    }[d];
  }

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarMes(yyyyMM: string): string {
    const [ano, mes] = yyyyMM.split('-');
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${nomes[+mes - 1]} ${ano}`;
  }
}