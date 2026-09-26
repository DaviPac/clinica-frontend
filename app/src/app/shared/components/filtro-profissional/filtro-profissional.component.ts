import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { Usuario } from '../../../core/models/usuario.model';
import { CampoComponent } from '../../ui/campo/campo.component';

@Component({
  selector: 'app-filtro-profissional',
  imports: [CampoComponent],
  templateUrl: './filtro-profissional.component.html',
  styleUrl: './filtro-profissional.component.css',
})
export class FiltroProfissionalComponent implements OnInit {
  private usuarioService = inject(UsuarioService);

  profissionalId = input<string | undefined>(undefined);
  defaultText = input<string>('Todos os profissionais');
  
  changed = output<string | undefined>();

  usuarios = signal<Usuario[]>([]);

  ngOnInit() {
    this.usuarioService.listar().subscribe(lista => this.usuarios.set(lista));
  }

  onChange(valor: string) {
    this.changed.emit(valor === '' ? undefined : valor);
  }
}
