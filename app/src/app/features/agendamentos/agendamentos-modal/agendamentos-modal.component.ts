import { Component, OnInit, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { AgendamentoDto, AgendamentoService } from '../../../core/services/agendamento/agendamento.service';
import { PacienteService } from '../../../core/services/paciente/paciente.service';
import { ServicoService } from '../../../core/services/servico/servico.service';
import { Paciente } from '../../../core/models/paciente.model';
import { Servico } from '../../../core/models/servico.model';
import { toRFC3339Brasilia, addSemanas } from '../../../core/utils/data.utils';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';

@Component({
  selector: 'app-agendamentos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agendamentos-modal.component.html',
})
export class AgendamentosModalComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  
  isAdmin = this.authService.isAdmin();
  fechar = output<void>();
  salvo = output<void>();

  pacientes = signal<Paciente[]>([]);
  servicos = signal<Servico[]>([]);
  usuarios = signal<any[]>([]); // Signal para armazenar a lista de usuários
  
  loading = signal(false);
  erro = signal<string | null>(null);

  form: FormGroup;

  // Preview da última sessão da série
  previewUltimaSessao = computed(() => {
    const { recorrente, data_hora_inicio, total_sessoes, intervalo_semanas } = this.form.getRawValue();
    if (!recorrente || !data_hora_inicio || total_sessoes < 2) return null;
    const inicio = new Date(data_hora_inicio);
    if (isNaN(inicio.getTime())) return null;
    const ultima = addSemanas(inicio, (total_sessoes - 1) * intervalo_semanas);
    return ultima.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  });

  get recorrente() { return this.form.controls['recorrente'].value; }

  constructor(
    private fb: FormBuilder,
    private agendamentoService: AgendamentoService,
    private pacienteService: PacienteService,
    private servicoService: ServicoService,
  ) {
    const usuarioAtualId = this.authService.usuario()?.id || 0;
    this.form = this.fb.nonNullable.group({
      usuario_id:        [usuarioAtualId],
      paciente_id:       [0, [Validators.required, Validators.min(1)]],
      servico_id:        [0, [Validators.required, Validators.min(1)]],
      data_hora_inicio:  ['', Validators.required],
      duracao_minutos:   [60, [Validators.required, Validators.min(1)]],  // ← novo
      valor_combinado:   [0, [Validators.required, Validators.min(0.01)]],
      recorrente:        [false],
      total_sessoes:     [10],
      intervalo_semanas: [1],
    });

    // Se for admin, torna o usuario_id obrigatório
    if (this.isAdmin) {
      this.form.controls['usuario_id'].addValidators([Validators.required, Validators.min(1)]);
    }
  }

  ngOnInit() {
    this.servicoService.listar().subscribe(s => this.servicos.set(s));

    if (this.isAdmin) {
      // 1. Busca usuários
      this.usuarioService.listar().subscribe(u => this.usuarios.set(u));

      // 2. Escuta mudanças no select de profissional
      this.form.controls['usuario_id'].valueChanges.subscribe(id => {
        // Reseta o paciente ao trocar o profissional
        this.form.controls['paciente_id'].setValue(0);
        
        if (id && id != 0) {
          this.pacienteService.listar(false, id.toString()).subscribe(p => this.pacientes.set(p));
        } else {
          this.pacientes.set([]);
        }
      });

      // 3. Carregamento inicial caso o form já inicie com um usuario_id válido
      const initialId = this.form.controls['usuario_id'].value;
      if (initialId && initialId != 0) {
        this.pacienteService.listar(false, initialId.toString()).subscribe(p => this.pacientes.set(p));
      }

    } else {
      // Se não for admin, carrega os pacientes associados ao profissional logado normalmente
      this.pacienteService.listar().subscribe(p => this.pacientes.set(p));
    }

    // Ao selecionar um serviço, pré-preenche o valor combinado
    this.form.controls['servico_id'].valueChanges.subscribe(id => {
      const s = this.servicos().find(sv => sv.id === +id);
      if (s) this.form.controls['valor_combinado'].setValue(s.valor_atual);
    });
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.erro.set(null);

    const raw = this.form.getRawValue();

    const dto: AgendamentoDto = {
      paciente_id:      Number(raw.paciente_id),
      servico_id:       Number(raw.servico_id),
      data_hora_inicio: toRFC3339Brasilia(new Date(raw.data_hora_inicio)),
      duracao_minutos:    raw.duracao_minutos,
      valor_combinado:  raw.valor_combinado,
      recorrente:       raw.recorrente,
      ...(raw.recorrente ? {
        total_sessoes:     raw.total_sessoes,
        intervalo_semanas: raw.intervalo_semanas,
      } : {}),
    };

    // Anexa o usuario_id no DTO apenas se for admin
    let profissionalID: string | undefined = undefined;
    if (this.isAdmin && raw.usuario_id) {
      profissionalID = raw.usuario_id.toString();
    }

    this.agendamentoService.criar(dto, profissionalID).subscribe({
      next: () => this.salvo.emit(),
      error: (err: Error) => {
        // Trata 409 Conflict com mensagem amigável
        const msg = err.message.toLowerCase().includes('conflito')
          ? 'Conflito de horário com outro agendamento. Escolha outro horário.'
          : err.message;
        this.erro.set(msg);
        this.loading.set(false);
      },
    });
  }
}