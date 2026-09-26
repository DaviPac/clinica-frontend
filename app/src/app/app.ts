import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TemaService } from './core/services/tema/tema.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('app');

  // Injetado na raiz para que o tema seja aplicado assim que a app sobe,
  // independentemente de qual tela renderizar primeiro.
  private readonly tema = inject(TemaService);
}
// commit so para trigger na CI, pode ignorar