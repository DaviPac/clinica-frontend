import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceiroService, RelatorioFinanceiro } from '../../../core/services/financeiro/financeiro.service';

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

  constructor(private service: FinanceiroService) {}

  ngOnInit() { this.carregar(); }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    this.service.getRelatorio(this.periodoSelecionado()).subscribe({
      next: r => {
        this.relatorio.set(r);
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  onPeriodoChange(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.periodoSelecionado.set(valor);
      this.carregar();
    }
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