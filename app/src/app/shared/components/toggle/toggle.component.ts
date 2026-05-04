import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  standalone: true,
  templateUrl: './toggle.component.html',
  styleUrl: './toggle.component.css',
})
export class ToggleComponent {
  checked = input.required<boolean>();
  label = input<string>('');
  disabled = input<boolean>(false);

  changed = output<boolean>();

  onToggle() {
    if (this.disabled()) return;
    this.changed.emit(!this.checked());
  }
}
