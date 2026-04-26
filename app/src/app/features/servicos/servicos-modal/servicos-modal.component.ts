// servicos-modal.component.ts
import { Component, input, output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { CriarServicoDto, AtualizarServicoDto, ServicoService } from '../../../core/services/servico/servico.service';
import { Servico } from '../../../core/models/servico.model';

interface ServicoForm {
  nome: FormControl<string>;
  valor_atual: FormControl<number>;
  pacote: FormControl<boolean>;
  ativo: FormControl<boolean>;
}

@Component({
  selector: 'app-servicos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './servicos-modal.component.html',
})
export class ServicosModalComponent implements OnInit {
  servico = input<Servico | null>(null);

  fechar = output<void>();
  salvo = output<void>();

  // Form totalmente tipado — sem any, sem cast
  form: FormGroup<ServicoForm>;

  loading = signal(false);
  erro = signal<string | null>(null);

  get modoEdicao() { return !!this.servico(); }
  get titulo() { return this.modoEdicao ? 'Editar serviço' : 'Novo serviço'; }
  get labelBotao() { return this.modoEdicao ? 'Salvar' : 'Criar'; }

  constructor(
    private fb: FormBuilder,
    private service: ServicoService
  ) {
    this.form = this.fb.nonNullable.group({
      nome:        ['', Validators.required],
      valor_atual: [0, [Validators.required, Validators.min(0.01)]],
      pacote:      [false],
      ativo:       [true],
    }) as FormGroup<ServicoForm>;
  }

  ngOnInit() {
    const s = this.servico();
    if (s) {
      this.form.patchValue({
        nome:        s.nome,
        valor_atual: s.valor_atual,
        pacote:      s.is_pacote,
        ativo:       s.ativo,
      });
    }
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.erro.set(null);

    // getRawValue() agora retorna tipo inferido corretamente
    const { nome, valor_atual, pacote, ativo } = this.form.getRawValue();
    const s = this.servico();

    // Sem cast — cada branch monta o DTO correto
    const op$ = s
      ? this.service.atualizar(s.id, { nome, valor_atual, pacote, ativo } satisfies AtualizarServicoDto)
      : this.service.criar({ nome, valor_atual, pacote } satisfies CriarServicoDto);

    op$.subscribe({
      next: () => this.salvo.emit(),
      error: (err: Error) => {
        this.erro.set(err.message);
        this.loading.set(false);
      },
    });
  }
}