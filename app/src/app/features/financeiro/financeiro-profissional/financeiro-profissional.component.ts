import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FinanceiroService } from '../../../core/services/financeiro/financeiro.service';
import { AcertoComissao, SaldoAReceber } from '../../../core/models/finenceiro.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';

@Component({
  selector: 'app-financeiro-profissional',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './financeiro-profissional.component.html',
})
export class FinanceiroProfissionalComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  isAdmin = this.authService.isAdmin();

  periodoSelecionado = signal(this.mesAtual());

  saldo = signal<SaldoAReceber | null>(null);
  acertos = signal<AcertoComissao[]>([]);
  profissionais = signal<{ id: number; nome: string }[]>([]);

  carregandoSaldo = signal(false);
  carregandoAcertos = signal(false);
  salvandoAcerto = signal(false);

  erro = signal<string | null>(null);
  erroAcerto = signal<string | null>(null);
  sucessoAcerto = signal(false);

  totalRepassadoPeriodo = computed(() =>
    this.acertos()
      .filter(a => a.periodo_referencia === this.periodoSelecionado())
      .reduce((sum, a) => sum + a.valor_pago, 0)
  );

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private service: FinanceiroService
  ) {
    this.form = fb.group({
      profissionalId: [null as number | null, [Validators.required]],
      valor_pago: [0, [Validators.required, Validators.min(0.01)]],
      observacao: [''],
    });
  }

  ngOnInit() {
    if (this.isAdmin) {
      this.carregarProfissionais();
      this.form.get('profissionalId')?.valueChanges.subscribe(() => {
        this.carregarTudo();
      });
    } else {
      // Profissional só visualiza — sem formulário de criação
      this.carregarTudo();
    }
  }

  carregarTudo() {
    this.carregarSaldo();
    this.carregarAcertos();
  }

  carregarProfissionais() {
    this.usuarioService.listar().subscribe({
      next: (lista) => this.profissionais.set(lista.filter(u => u.role !== 'ADMIN')),
      error: (err: Error) => console.error('Erro ao carregar profissionais', err),
    });
  }

  carregarSaldo() {
    const profId = this.isAdmin ? this.form.get('profissionalId')?.value : undefined;

    if (this.isAdmin && !profId) {
      this.saldo.set(null);
      this.form.controls['valor_pago'].setValue(0);
      return;
    }

    this.carregandoSaldo.set(true);

    this.service.getSaldoAReceber(this.periodoSelecionado(), profId).subscribe({
      next: s => {
        this.saldo.set(s);
        // Preenche o campo com o saldo pendente de repasse
        if (this.isAdmin) {
          this.form.controls['valor_pago'].setValue(s.saldo_a_receber);
        }
        this.carregandoSaldo.set(false);
      },
      error: (err: Error) => {
        this.erro.set(err.message);
        this.carregandoSaldo.set(false);
      },
    });
  }

  carregarAcertos() {
    const profId = this.isAdmin ? this.form.get('profissionalId')?.value : undefined;

    if (this.isAdmin && !profId) {
      this.acertos.set([]);
      return;
    }

    this.carregandoAcertos.set(true);

    this.service.getAcertos(profId).subscribe({
      next: lista => {
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
      profissional_id: raw.profissionalId,
      periodo_referencia: this.periodoSelecionado(),
      valor_pago: raw.valor_pago,
      ...(raw.observacao?.trim() ? { observacao: raw.observacao.trim() } : {}),
    };

    this.service.criarAcerto(dto).subscribe({
      next: novoAcerto => {
        this.acertos.update(lista => [novoAcerto, ...lista]);
        this.sucessoAcerto.set(true);
        this.form.patchValue({ valor_pago: 0, observacao: '' });
        this.salvandoAcerto.set(false);
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
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[+mes - 1]} ${ano}`;
  }

  private mesAtual(): string {
    return new Date().toISOString().slice(0, 7);
  }
}