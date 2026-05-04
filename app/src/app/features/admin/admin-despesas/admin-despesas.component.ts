import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FinanceiroService } from '../../../core/services/financeiro/financeiro.service';
import { DespesaClinica } from '../../../core/models/financeiro.model';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';

@Component({
  selector: 'app-admin-despesas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToggleComponent],
  templateUrl: './admin-despesas.component.html',
})
export class AdminDespesasComponent implements OnInit {
  private todas = signal<DespesaClinica[]>([]);

  apenasEmAberto = signal(true);
  modalAberto = signal(false);
  pagando = signal<number | null>(null);
  salvando = signal(false);
  carregando = signal(true);
  erro = signal<string | null>(null);
  erroModal = signal<string | null>(null);

  despesas = computed(() => {
    const lista = this.todas();
    return this.apenasEmAberto() ? lista.filter(d => !d.status_pagamento) : lista;
  });

  totalEmAberto = computed(() =>
    this.todas()
      .filter(d => !d.status_pagamento)
      .reduce((s, d) => s + d.valor, 0)
  );

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private service: FinanceiroService,
  ) {
    this.form = fb.nonNullable.group({
      descricao:       ['', Validators.required],
      valor:           [0, [Validators.required, Validators.min(0.01)]],
      data_vencimento: ['', Validators.required],
      categoria:       ['FIXA' as 'FIXA' | 'VARIAVEL', Validators.required],
    });
  }

  ngOnInit() { this.carregar(); }

  carregar() {
    this.carregando.set(true);
    // Busca todas — filtro é local via computed()
    this.service.getDespesas().subscribe({
      next: lista => {
        this.todas.set(
          lista.sort((a, b) =>
            new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
          )
        );
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregando.set(false);
      },
    });
  }

  marcarPago(despesa: DespesaClinica) {
    this.pagando.set(despesa.id);
    this.service.pagarDespesa(despesa.id).subscribe({
      next: () => {
        this.todas.update(lista =>
          lista.map(d => d.id === despesa.id ? { ...d, status_pagamento: true } : d)
        );
        this.pagando.set(null);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.pagando.set(null);
      },
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.salvando.set(true);
    this.erroModal.set(null);

    this.service.criarDespesa(this.form.getRawValue()).subscribe({
      next: nova => {
        this.todas.update(lista =>
          [...lista, nova].sort((a, b) =>
            new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
          )
        );
        this.form.reset({ descricao: '', valor: 0, data_vencimento: '', categoria: 'FIXA' });
        this.modalAberto.set(false);
        this.salvando.set(false);
      },
      error: (err: Error) => {
        this.erroModal.set(err.message);
        this.salvando.set(false);
      },
    });
  }

  vencimentoClass(iso: string, paga: boolean): string {
    if (paga) return 'text-gray-400';
    const hoje = new Date();
    const venc = new Date(iso);
    hoje.setHours(0, 0, 0, 0);
    return venc < hoje ? 'text-red-700 font-medium' : 'text-gray-600';
  }

  formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
  }
}