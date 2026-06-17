import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { LevelHabitStateService, Quest } from '../../state/levelhabit-state.service';

type PrototypeView = 'dashboard' | 'quests' | 'hero' | 'achievements' | 'analytics';
type QuestFilter = 'active' | 'all' | 'completed';

const VIEW_COPY: Record<PrototypeView, { eyebrow: string; title: string; summary: string }> = {
  dashboard: {
    eyebrow: 'Today',
    title: 'Quest board',
    summary: 'A focused run of daily habits, XP progress, streak safety, and rewards.'
  },
  quests: {
    eyebrow: 'Quest log',
    title: 'Active habits',
    summary: 'Daily routines framed as repeatable quests with cadence, difficulty, and XP.'
  },
  hero: {
    eyebrow: 'Hero',
    title: 'Profile progression',
    summary: 'A personal profile that levels up as habits become visible progress.'
  },
  achievements: {
    eyebrow: 'Achievements',
    title: 'Milestone vault',
    summary: 'Unlockable badges for streaks, balanced routines, and high-consistency days.'
  },
  analytics: {
    eyebrow: 'Analytics',
    title: 'Consistency map',
    summary: 'A lightweight read on weekly momentum, category balance, and XP output.'
  }
};

@Component({
  selector: 'app-prototype-page',
  standalone: true,
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
    const view = this.routeData()['view'];

    return this.isPrototypeView(view) ? view : 'dashboard';
  });

  protected readonly copy = computed(() => VIEW_COPY[this.view()]);

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

  protected readonly topQuest = computed(() => {
    const activeQuest = this.game.activeQuests()[0];

    return activeQuest ?? this.game.quests()[0];
  });

  protected readonly chartMaxXp = computed(() =>
    Math.max(...this.game.weeklyHistory().map((day) => day.xp), 1)
  );

  protected achievementPercent(progress: number, target: number): number {
    return Math.min(100, Math.round((progress / target) * 100));
  }

  protected toggleQuest(quest: Quest): void {
    this.game.toggleQuest(quest.id);
  }

  protected setFilter(filter: QuestFilter): void {
    this.questFilter.set(filter);
  }

  private isPrototypeView(view: unknown): view is PrototypeView {
    return (
      view === 'dashboard' ||
      view === 'quests' ||
      view === 'hero' ||
      view === 'achievements' ||
      view === 'analytics'
    );
  }
}
