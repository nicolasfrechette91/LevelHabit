import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { AnalyticsBucketResponse } from '../../analytics/analytics-api.service';
import { AuthService } from '../../auth/auth.service';
import type { QuestUpsertRequest } from '../../quests/quest-api.service';
import {
  PERSISTED_QUEST_CATEGORIES,
  PERSISTED_QUEST_DIFFICULTIES,
  PERSISTED_QUEST_FREQUENCIES,
  type PersistedQuestCategory,
  type PersistedQuestDifficulty,
  type PersistedQuestFrequency,
  type Quest
} from '../../state/levelhabit.models';
import { LevelHabitStateService } from '../../state/levelhabit-state.service';
import {
  isPrototypeView,
  PROTOTYPE_VIEW_COPY,
  type PrototypeView
} from './prototype-view.model';

type QuestFilter = 'active' | 'all' | 'archived';

@Component({
  selector: 'app-prototype-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './prototype-page.component.html',
  styleUrls: ['./prototype-page.component.scss']
})
export class PrototypePageComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly game = inject(LevelHabitStateService);

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data
  });

  protected readonly questFilter = signal<QuestFilter>('active');
  protected readonly editingQuestId = signal<string | null>(null);
  protected readonly questCategories = PERSISTED_QUEST_CATEGORIES;
  protected readonly questDifficulties = PERSISTED_QUEST_DIFFICULTIES;
  protected readonly questFrequencies = PERSISTED_QUEST_FREQUENCIES;
  protected readonly questForm = this.formBuilder.group({
    title: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(140)
    ]),
    description: this.formBuilder.control('', [Validators.maxLength(1000)]),
    category: this.formBuilder.control<PersistedQuestCategory>(
      PERSISTED_QUEST_CATEGORIES[0],
      [Validators.required]
    ),
    difficulty: this.formBuilder.control<PersistedQuestDifficulty>(
      PERSISTED_QUEST_DIFFICULTIES[0],
      [Validators.required]
    ),
    frequency: this.formBuilder.control<PersistedQuestFrequency>(
      PERSISTED_QUEST_FREQUENCIES[0],
      [Validators.required]
    )
  });

  protected readonly view = computed<PrototypeView>(() => {
    const data = this.routeData() as Readonly<Record<string, unknown>>;
    const view = data['view'];

    return isPrototypeView(view) ? view : 'dashboard';
  });

  protected readonly copy = computed(() => PROTOTYPE_VIEW_COPY[this.view()]);

  protected readonly profileUser = computed(() => this.auth.user());

  protected readonly profileHero = computed(() => this.auth.heroProfile());

  protected readonly playerDisplayName = computed(
    () => this.profileUser()?.displayName ?? 'Prototype player'
  );

  protected readonly heroDisplayName = computed(
    () => this.profileHero()?.heroName ?? this.game.levelTitle()
  );

  protected readonly profileLevel = computed(
    () => this.profileHero()?.level ?? this.game.level()
  );

  protected readonly profileTotalXp = computed(
    () => this.profileHero()?.totalXp ?? this.game.totalXp()
  );

  protected readonly profileCurrentStreak = computed(
    () => this.profileHero()?.currentStreak ?? this.game.currentStreak()
  );

  protected readonly profileLevelProgress = computed(() => this.game.levelProgress());

  protected readonly profileXpInCurrentLevel = computed(() =>
    this.game.xpInCurrentLevel()
  );

  protected readonly profileXpRequiredForNextLevel = computed(() =>
    this.game.xpRequiredForNextLevel()
  );

  protected readonly profileXpToNextLevel = computed(() =>
    this.game.xpToNextLevel()
  );

  protected readonly profileInitials = computed(() => {
    const name = this.heroDisplayName();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    return initials || 'LH';
  });

  protected readonly filteredQuests = computed(() => {
    const quests = this.game.quests();

    switch (this.questFilter()) {
      case 'active':
        return quests.filter((quest) =>
          !quest.isArchived && (this.game.usesQuestApi() || !quest.completed)
        );
      case 'archived':
        return quests.filter((quest) => quest.isArchived);
      default:
        return quests;
    }
  });

  protected readonly topQuest = computed<Quest | null>(() => {
    const activeQuest = this.game.activeQuests()[0];
    const fallbackQuest = this.game.quests()[0];

    return activeQuest ?? fallbackQuest ?? null;
  });

  protected readonly achievementPreview = computed(() =>
    this.game.achievements().slice(0, 3)
  );

  protected readonly titleOptions = this.game.availableTitles;

  protected readonly chartMaxXp = computed(() =>
    Math.max(...this.game.weeklyHistory().map((day) => day.xp), 1)
  );

  protected readonly analyticsCategoryMax = computed(() =>
    this.maxBucketCount(
      this.game.analyticsSummary()?.completionCountByCategory ?? []
    )
  );

  protected readonly analyticsDifficultyMax = computed(() =>
    this.maxBucketCount(
      this.game.analyticsSummary()?.completionCountByDifficulty ?? []
    )
  );

  ngOnInit(): void {
    this.game.loadQuests();
    this.game.loadAchievements();

    if (this.view() === 'analytics') {
      this.game.loadAnalytics();
    }
  }

  protected achievementPercent(progress: number, target: number): number {
    if (target <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((progress / target) * 100));
  }

  private maxBucketCount(buckets: readonly AnalyticsBucketResponse[]): number {
    return Math.max(...buckets.map((bucket) => bucket.count), 1);
  }

  protected toggleQuest(quest: Quest): void {
    this.game.toggleQuest(quest.id);
  }

  protected completeQuest(quest: Quest): void {
    if (
      !this.game.usesQuestApi()
      || quest.isArchived
      || quest.completed
      || this.game.isQuestCompletionInFlight(quest.id)
    ) {
      return;
    }

    this.game
      .completeQuest(quest.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => undefined
      });
  }

  protected setFilter(filter: QuestFilter): void {
    this.questFilter.set(filter);
  }

  protected saveQuest(): void {
    if (!this.game.usesQuestApi()) {
      return;
    }

    if (this.questForm.invalid) {
      this.questForm.markAllAsTouched();
      return;
    }

    const request = this.readQuestForm();
    const editingQuestId = this.editingQuestId();
    const saveQuest = editingQuestId
      ? this.game.updateQuest(editingQuestId, request)
      : this.game.createQuest(request);

    saveQuest
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.resetQuestForm(),
        error: () => undefined
      });
  }

  protected startEdit(quest: Quest): void {
    if (!this.game.usesQuestApi() || quest.isArchived) {
      return;
    }

    this.editingQuestId.set(quest.id);
    this.questForm.setValue({
      title: quest.title,
      description: quest.summary === 'No description yet.' ? '' : quest.summary,
      category: quest.category as PersistedQuestCategory,
      difficulty: quest.difficulty as PersistedQuestDifficulty,
      frequency: quest.cadence as PersistedQuestFrequency
    });
  }

  protected archiveQuest(quest: Quest): void {
    if (!this.game.usesQuestApi() || quest.isArchived) {
      return;
    }

    this.game
      .archiveQuest(quest.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.editingQuestId() === quest.id) {
            this.resetQuestForm();
          }
        },
        error: () => undefined
      });
  }

  protected resetQuestForm(): void {
    this.editingQuestId.set(null);
    this.questForm.reset({
      title: '',
      description: '',
      category: PERSISTED_QUEST_CATEGORIES[0],
      difficulty: PERSISTED_QUEST_DIFFICULTIES[0],
      frequency: PERSISTED_QUEST_FREQUENCIES[0]
    });
  }

  private readQuestForm(): QuestUpsertRequest {
    const value = this.questForm.getRawValue();

    return {
      title: value.title.trim(),
      description: value.description.trim(),
      category: value.category as PersistedQuestCategory,
      difficulty: value.difficulty as PersistedQuestDifficulty,
      frequency: value.frequency as PersistedQuestFrequency
    };
  }
}
