import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FinanceiroService } from '../../../core/services/financeiro/financeiro.service';
import { AcertoComissao, SaldoDevedor } from '../../../core/models/finenceiro.model';

@Component({
  selector: 'app-financeiro-profissional',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './financeiro-profissional.component.html',
})
export class FinanceiroProfissionalComponent implements OnInit {
  // Período selecionado no formato YYYY-MM
  periodoSelecionado = signal(this.mesAtual());

  saldo = signal<SaldoDevedor | null>(null);
  acertos = signal<AcertoComissao[]>([]);

  carregandoSaldo = signal(false);
  carregandoAcertos = signal(false);
  salvandoAcerto = signal(false);

  erro = signal<string | null>(null);
  erroAcerto = signal<string | null>(null);
  sucessoAcerto = signal(false);

  totalAcertadoPeriodo = computed(() =>
    this.acertos()
      .filter(a => a.periodo_referencia === this.periodoSelecionado() && a.confirmado_pelo_admin)
      .reduce((sum, a) => sum + a.valor_pago_a_clinica, 0)
  );

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private service: FinanceiroService
  ) {
    this.form = fb.nonNullable.group({
      valor_pago_a_clinica: [0, [Validators.required, Validators.min(0.01)]],
      observacao: [''],
    });
  }

  ngOnInit() {
    this.carregarTudo();
  }

  carregarTudo() {
    this.carregarSaldo();
    this.carregarAcertos();
  }

  carregarSaldo() {
    this.carregandoSaldo.set(true);
    this.service.getSaldo(this.periodoSelecionado()).subscribe({
      next: s => {
        this.saldo.set(s);
        // Pré-preenche o campo com o saldo devedor atual
        this.form.controls['valor_pago_a_clinica'].setValue(s.saldo_devido);
        this.carregandoSaldo.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregandoSaldo.set(false);
      },
    });
  }

  carregarAcertos() {
    this.carregandoAcertos.set(true);
    this.service.getAcertos().subscribe({
      next: lista => {
        // Mais recentes primeiro
        this.acertos.set(
          lista.sort((a, b) =>
            new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime()
          )
        );
        this.carregandoAcertos.set(false);
      },
      error: () => this.carregandoAcertos.set(false),
    });
  }

  onPeriodoChange(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.periodoSelecionado.set(valor);
      this.carregarTudo();
    }
  }

  submit() {
    if (this.form.invalid) return;

    this.salvandoAcerto.set(true);
    this.erroAcerto.set(null);
    this.sucessoAcerto.set(false);

    const raw = this.form.getRawValue();
    const dto = {
      periodo_referencia: this.periodoSelecionado(),
      valor_pago_a_clinica: raw.valor_pago_a_clinica,
      ...(raw.observacao.trim() ? { observacao: raw.observacao.trim() } : {}),
    };

    this.service.criarAcerto(dto).subscribe({
      next: novoAcerto => {
        // Insere no topo da lista sem recarregar
        this.acertos.update(lista => [novoAcerto, ...lista]);
        this.sucessoAcerto.set(true);
        this.form.reset({ valor_pago_a_clinica: 0, observacao: '' });
        this.salvandoAcerto.set(false);
        // Recarrega saldo para refletir o novo estado
        this.carregarSaldo();
        setTimeout(() => this.sucessoAcerto.set(false), 3000);
      },
      error: (err: Error) => {
        this.erroAcerto.set(err.message);
        this.salvandoAcerto.set(false);
      },
    });
  }

  formatarValor(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  formatarMes(yyyyMM: string): string {
    const [ano, mes] = yyyyMM.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun',
                   'Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[+mes - 1]} ${ano}`;
  }

  private mesAtual(): string {
    return new Date().toISOString().slice(0, 7);
  }
}