import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { BackendStatus } from '../../../core/services/backend-status.service';
import { TranslatePipe } from '../../../i18n/i18n.pipes';

@Component({
  selector: 'app-backend-wakeup',
  imports: [NgOptimizedImage, TranslatePipe],
  templateUrl: './backend-wakeup.component.html',
  styleUrl: './backend-wakeup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackendWakeupComponent {
  readonly status = input.required<BackendStatus>();
  readonly retry = output<void>();
}
