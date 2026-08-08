import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { FiltroProfissionalComponent } from '../../../shared/components/filtro-profissional/filtro-profissional.component';
import { FinanceiroService, RelatorioSessoes } from '../../../core/services/financeiro/financeiro.service';

@Component({
  selector: 'app-admin-relatorio-sessoes',
  standalone: true,
  imports: [CommonModule, AlertComponent, StatusBadgeComponent, FiltroProfissionalComponent],
  templateUrl: './admin-relatorio-sessoes.component.html',
})
export class AdminRelatorioSessoesComponent {
  relatorio = signal<RelatorioSessoes | null>(null);
  inicio = signal(this.primeiroDiaDoMes());
  fim = signal(new Date().toISOString().slice(0, 10));
  profissionalId = signal<number | undefined>(undefined);
  carregando = signal(false);
  erro = signal<string | null>(null);

  constructor(private service: FinanceiroService) {}

  get profissionalIdStr(): string | undefined {
    const id = this.profissionalId();
    return id ? String(id) : undefined;
  }

  gerar() {
    if (!this.profissionalId()) {
      this.erro.set('Selecione um profissional para gerar o relatório.');
      return;
    }
    if (!this.inicio() || !this.fim()) {
      this.erro.set('Informe as datas inicial e final.');
      return;
    }
    if (this.inicio() > this.fim()) {
      this.erro.set('Data inicial não pode ser posterior à data final.');
      return;
    }
    this.carregando.set(true);
    this.erro.set(null);
    this.service.getRelatorioSessoes(this.inicio(), this.fim(), this.profissionalId()).subscribe({
      next: r => { this.relatorio.set(r); this.carregando.set(false); },
      error: (err: Error) => { this.erro.set(err.message); this.carregando.set(false); },
    });
  }

  onProfissionalChange(id: string | undefined) {
    this.profissionalId.set(id ? +id : undefined);
  }

  onDataChange(campo: 'inicio' | 'fim', evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    if (campo === 'inicio') this.inicio.set(valor);
    else this.fim.set(valor);
  }

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarDataHora(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatarData(iso: string) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private primeiroDiaDoMes(): string {
    return new Date().toISOString().slice(0, 8) + '01';
  }
}
