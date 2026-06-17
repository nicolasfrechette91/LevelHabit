import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { Quest } from '../../state/levelhabit.models';
import { LevelHabitStateService } from '../../state/levelhabit-state.service';
import {
  isPrototypeView,
  PROTOTYPE_VIEW_COPY,
  type PrototypeView
} from './prototype-view.model';

type QuestFilter = 'active' | 'all' | 'completed';

@Component({
  selector: 'app-prototype-page',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './prototype-page.component.html',
  styleUrls: ['./prototype-page.component.scss']
})
export class PrototypePageComponent {
  protected readonly game = inject(LevelHabitStateService);

  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data
  });

  protected readonly questFilter = signal<QuestFilter>('active');

  protected readonly view = computed<PrototypeView>(() => {
    const data = this.routeData() as Readonly<Record<string, unknown>>;
    const view = data['view'];

    return isPrototypeView(view) ? view : 'dashboard';
  });

  protected readonly copy = computed(() => PROTOTYPE_VIEW_COPY[this.view()]);

  protected readonly filteredQuests = computed(() => {
    const quests = this.game.quests();

    switch (this.questFilter()) {
      case 'active':
        return quests.filter((quest) => !quest.completed);
      case 'completed':
        return quests.filter((quest) => quest.completed);
      default:
        return quests;
    }
  });

  protected readonly topQuest = computed<Quest>(() => {
    const activeQuest = this.game.activeQuests()[0];
    const fallbackQuest = this.game.quests()[0];

    if (!fallbackQuest) {
      throw new Error('Prototype data must include at least one quest.');
    }

    return activeQuest ?? fallbackQuest;
  });

  protected readonly achievementPreview = computed(() =>
    this.game.achievements().slice(0, 3)
  );

  protected readonly titleOptions = this.game.availableTitles;

  protected readonly chartMaxXp = computed(() =>
    Math.max(...this.game.weeklyHistory().map((day) => day.xp), 1)
  );

  protected achievementPercent(progress: number, target: number): number {
    if (target <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((progress / target) * 100));
  }

  protected toggleQuest(quest: Quest): void {
    this.game.toggleQuest(quest.id);
  }

  protected setFilter(filter: QuestFilter): void {
    this.questFilter.set(filter);
  }
}
