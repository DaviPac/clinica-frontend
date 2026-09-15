import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ModelosService } from '../../../../core/ia/gemini/modelos.service';
import { NivelRaciocinio, ROTULO_RACIOCINIO } from '../../../../core/ia/ia.config';

const NIVEIS: NivelRaciocinio[] = ['desligado', 'equilibrado', 'profundo'];

@Component({
  selector: 'app-seletor-modelo',
  standalone: true,
  templateUrl: './seletor-modelo.component.html',
})
export class SeletorModeloComponent {
  readonly modelos = inject(ModelosService);

  readonly modeloId = input.required<string>();
  readonly nivel = input.required<NivelRaciocinio>();

  readonly modeloMudou = output<string>();
  readonly nivelMudou = output<NivelRaciocinio>();

  readonly aberto = signal(false);
  readonly niveis = NIVEIS;
  readonly rotulos = ROTULO_RACIOCINIO;

  readonly rotuloModelo = computed(
    () => this.modelos.modelo(this.modeloId())?.rotulo ?? this.modeloId(),
  );
  readonly suportaRaciocinio = computed(
    () => this.modelos.modelo(this.modeloId())?.suportaRaciocinio ?? false,
  );
  readonly raciocinioAtivo = computed(
    () => this.suportaRaciocinio() && this.nivel() !== 'desligado',
  );
  readonly rotuloNivelCurto = computed(() =>
    this.nivel() === 'profundo' ? 'raciocínio profundo' : 'raciocínio',
  );

  escolherModelo(id: string): void {
    this.aberto.set(false);
    if (id !== this.modeloId()) this.modeloMudou.emit(id);
  }

  escolherNivel(nivel: NivelRaciocinio): void {
    this.aberto.set(false);
    if (nivel !== this.nivel()) this.nivelMudou.emit(nivel);
  }
}
