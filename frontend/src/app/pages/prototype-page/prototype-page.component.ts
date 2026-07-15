import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import type {
  AnalyticsBucketResponse,
  AnalyticsDailyMetricResponse
} from '../../analytics/analytics-api.service';
import { AuthService } from '../../auth/auth.service';
import { BrowserNotificationService } from '../../notifications/browser-notification.service';
import type { HabitUpsertRequest } from '../../habits/habit-api.service';
import {
  REMINDER_DAYS,
  HabitReminderApiService,
  type HabitReminderResponse,
  type ReminderDay,
  type UpsertHabitReminderRequest
} from '../../reminders/habit-reminder-api.service';
import {
  PERSISTED_QUEST_CATEGORIES,
  PERSISTED_QUEST_DIFFICULTIES,
  PERSISTED_QUEST_FREQUENCIES,
  type PersistedHabitCategory,
  type PersistedHabitDifficulty,
  type PersistedHabitFrequency,
  type Habit
} from '../../state/levelhabit.models';
import { LevelHabitStateService } from '../../state/levelhabit-state.service';
import {
  isPrototypeView,
  PROTOTYPE_VIEW_COPY,
  type PrototypeView
} from './prototype-view.model';

type HabitFilter = 'active' | 'all' | 'archived';

const FALLBACK_TIME_ZONE_ID = 'UTC';
const DEFAULT_REMINDER_TIME = '08:30';
const COMMON_TIME_ZONE_IDS = [
  'UTC',
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney'
] as const;

@Component({
  selector: 'app-prototype-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './prototype-page.component.html',
  styleUrls: ['./prototype-page.component.scss']
})
export class PrototypePageComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly game = inject(LevelHabitStateService);
  protected readonly browserNotifications = inject(BrowserNotificationService);

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly reminderApi = inject(HabitReminderApiService);
  private readonly browserTimeZoneId = this.resolveBrowserTimeZoneId();
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data
  });

  protected readonly habitFilter = signal<HabitFilter>('active');
  protected readonly editingHabitId = signal<string | null>(null);
  protected readonly reminderLoading = signal(false);
  protected readonly reminderSaving = signal(false);
  protected readonly reminderError = signal<string | null>(null);
  private readonly editingReminderExists = signal(false);
  protected readonly habitCategories = PERSISTED_QUEST_CATEGORIES;
  protected readonly habitDifficulties = PERSISTED_QUEST_DIFFICULTIES;
  protected readonly habitFrequencies = PERSISTED_QUEST_FREQUENCIES;
  protected readonly reminderDays = REMINDER_DAYS;
  protected readonly timeZoneOptions = this.resolveTimeZoneOptions();
  protected readonly habitForm = this.formBuilder.group({
    title: this.formBuilder.control('', [
      Validators.required,
      Validators.maxLength(140)
    ]),
    description: this.formBuilder.control('', [Validators.maxLength(1000)]),
    category: this.formBuilder.control<PersistedHabitCategory>(
      PERSISTED_QUEST_CATEGORIES[0],
      [Validators.required]
    ),
    difficulty: this.formBuilder.control<PersistedHabitDifficulty>(
      PERSISTED_QUEST_DIFFICULTIES[0],
      [Validators.required]
    ),
    frequency: this.formBuilder.control<PersistedHabitFrequency>(
      PERSISTED_QUEST_FREQUENCIES[0],
      [Validators.required]
    ),
    reminderEnabled: this.formBuilder.control(false),
    reminderTime: this.formBuilder.control(DEFAULT_REMINDER_TIME),
    reminderTimeZoneId: this.formBuilder.control(this.browserTimeZoneId),
    reminderDaysOfWeek: this.formBuilder.control<ReminderDay[]>(
      [...REMINDER_DAYS]
    )
  });

  protected readonly view = computed<PrototypeView>(() => {
    const data = this.routeData() as Readonly<Record<string, unknown>>;
    const view = data['view'];

    return isPrototypeView(view) ? view : 'dashboard';
  });

  protected readonly copy = computed(() => PROTOTYPE_VIEW_COPY[this.view()]);

  protected readonly profileUser = computed(() => this.auth.user());

  protected readonly progressProfile = computed(() => this.auth.progressProfile());

  protected readonly playerDisplayName = computed(
    () => this.profileUser()?.displayName ?? 'Prototype player'
  );

  protected readonly progressDisplayName = computed(
    () => this.progressProfile()?.displayName ?? this.game.levelTitle()
  );

  protected readonly profileLevel = computed(
    () => this.progressProfile()?.level ?? this.game.level()
  );

  protected readonly profileTotalXp = computed(
    () => this.progressProfile()?.totalXp ?? this.game.totalXp()
  );

  protected readonly profileCurrentStreak = computed(
    () => this.progressProfile()?.currentStreak ?? this.game.currentStreak()
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
    const name = this.progressDisplayName();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    return initials || 'LH';
  });

  protected readonly filteredHabits = computed(() => {
    const habits = this.game.habits();

    switch (this.habitFilter()) {
      case 'active':
        return habits.filter((habit) =>
          !habit.isArchived && (this.game.usesHabitApi() || !habit.completed)
        );
      case 'archived':
        return habits.filter((habit) => habit.isArchived);
      default:
        return habits;
    }
  });

  protected readonly topHabit = computed<Habit | null>(() => {
    const activeHabit = this.game.activeHabits()[0];
    const fallbackHabit = this.game.habits()[0];

    return activeHabit ?? fallbackHabit ?? null;
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

  protected readonly analyticsCompletionTrendMax = computed(() =>
    this.maxDailyMetricValue(
      this.game.analyticsSummary()?.completionsByDay ?? []
    )
  );

  protected readonly analyticsXpTrendMax = computed(() =>
    this.maxDailyMetricValue(this.game.analyticsSummary()?.xpByDay ?? [])
  );

  protected readonly analyticsTrendHasActivity = computed(() => {
    const summary = this.game.analyticsSummary();

    return summary
      ? this.hasDailyMetricValue(summary.completionsByDay ?? [])
        || this.hasDailyMetricValue(summary.xpByDay ?? [])
      : false;
  });

  protected readonly analyticsCompletionTrendTotal = computed(() =>
    this.sumDailyMetricValues(
      this.game.analyticsSummary()?.completionsByDay ?? []
    )
  );

  protected readonly analyticsXpTrendTotal = computed(() =>
    this.sumDailyMetricValues(this.game.analyticsSummary()?.xpByDay ?? [])
  );

  ngOnInit(): void {
    this.game.loadHabits();
    this.game.loadAchievements();
    this.updateReminderValidators(this.habitForm.controls.reminderEnabled.value);
    this.habitForm.controls.reminderEnabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateReminderValidators(enabled));

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

  protected analyticsTrendHeight(value: number, max: number): number {
    if (value <= 0 || max <= 0) {
      return 0;
    }

    return Math.max(12, Math.round((value / max) * 100));
  }

  protected analyticsBarWidth(value: number, max: number): number {
    if (value <= 0 || max <= 0) {
      return 0;
    }

    return Math.max(8, Math.round((value / max) * 100));
  }

  private maxBucketCount(buckets: readonly AnalyticsBucketResponse[]): number {
    return Math.max(...buckets.map((bucket) => bucket.count), 1);
  }

  private maxDailyMetricValue(
    buckets: readonly AnalyticsDailyMetricResponse[]
  ): number {
    return Math.max(...buckets.map((bucket) => bucket.value), 1);
  }

  private hasDailyMetricValue(
    buckets: readonly AnalyticsDailyMetricResponse[]
  ): boolean {
    return buckets.some((bucket) => bucket.value > 0);
  }

  private sumDailyMetricValues(
    buckets: readonly AnalyticsDailyMetricResponse[]
  ): number {
    return buckets.reduce((total, bucket) => total + bucket.value, 0);
  }

  protected toggleHabit(habit: Habit): void {
    this.game.toggleHabit(habit.id);
  }

  protected completeHabit(habit: Habit): void {
    if (
      !this.game.usesHabitApi()
      || habit.isArchived
      || habit.completed
      || this.game.isHabitCompletionInFlight(habit.id)
    ) {
      return;
    }

    this.game
      .completeHabit(habit.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => undefined
      });
  }

  protected setFilter(filter: HabitFilter): void {
    this.habitFilter.set(filter);
  }

  protected saveHabit(): void {
    if (!this.game.usesHabitApi()) {
      return;
    }

    if (this.habitForm.invalid) {
      this.habitForm.markAllAsTouched();
      return;
    }

    const request = this.readHabitForm();
    const editingHabitId = this.editingHabitId();
    const isCreatingHabit = editingHabitId === null;
    const saveHabit = editingHabitId
      ? this.game.updateHabit(editingHabitId, request)
      : this.game.createHabit(request);

    saveHabit
      .pipe(
        switchMap((savedHabit) =>
          this.saveReminderForHabit(savedHabit.id).pipe(
            map(() => savedHabit),
            catchError((error: unknown) => {
              if (isCreatingHabit) {
                this.editingHabitId.set(savedHabit.id);
              }

              this.reminderError.set(this.describeReminderError(error));

              return throwError(() => error);
            })
          )
        )
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.resetHabitForm(),
        error: () => undefined
      });
  }

  protected startEdit(habit: Habit): void {
    if (!this.game.usesHabitApi() || habit.isArchived) {
      return;
    }

    this.editingHabitId.set(habit.id);
    this.habitForm.setValue({
      title: habit.title,
      description: habit.summary === 'No description yet.' ? '' : habit.summary,
      category: habit.category as PersistedHabitCategory,
      difficulty: habit.difficulty as PersistedHabitDifficulty,
      frequency: habit.cadence as PersistedHabitFrequency,
      reminderEnabled: false,
      reminderTime: DEFAULT_REMINDER_TIME,
      reminderTimeZoneId: this.browserTimeZoneId,
      reminderDaysOfWeek: [...REMINDER_DAYS]
    });
    this.editingReminderExists.set(false);
    this.loadReminderForHabit(habit.id);
  }

  protected archiveHabit(habit: Habit): void {
    if (!this.game.usesHabitApi() || habit.isArchived) {
      return;
    }

    this.game
      .archiveHabit(habit.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.editingHabitId() === habit.id) {
            this.resetHabitForm();
          }
        },
        error: () => undefined
      });
  }

  protected resetHabitForm(): void {
    this.editingHabitId.set(null);
    this.editingReminderExists.set(false);
    this.reminderLoading.set(false);
    this.reminderSaving.set(false);
    this.reminderError.set(null);
    this.habitForm.reset({
      title: '',
      description: '',
      category: PERSISTED_QUEST_CATEGORIES[0],
      difficulty: PERSISTED_QUEST_DIFFICULTIES[0],
      frequency: PERSISTED_QUEST_FREQUENCIES[0],
      reminderEnabled: false,
      reminderTime: DEFAULT_REMINDER_TIME,
      reminderTimeZoneId: this.browserTimeZoneId,
      reminderDaysOfWeek: [...REMINDER_DAYS]
    });
  }

  protected reminderDaySelected(day: ReminderDay): boolean {
    return this.habitForm.controls.reminderDaysOfWeek.value.includes(day);
  }

  protected toggleReminderDay(day: ReminderDay, event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const selectedDays = new Set(this.habitForm.controls.reminderDaysOfWeek.value);

    if (target.checked) {
      selectedDays.add(day);
    } else {
      selectedDays.delete(day);
    }

    this.habitForm.controls.reminderDaysOfWeek.setValue(
      this.reminderDays.filter((candidate) => selectedDays.has(candidate))
    );
    this.habitForm.controls.reminderDaysOfWeek.markAsTouched();
  }

  protected reminderSummaryText(): string {
    const value = this.habitForm.getRawValue();

    if (!value.reminderEnabled) {
      return 'Reminders disabled';
    }

    if (value.reminderDaysOfWeek.length === 0) {
      return 'Select at least one day';
    }

    return `${this.formatReminderDays(value.reminderDaysOfWeek)} at ${this.formatReminderTime(value.reminderTime)}`;
  }

  protected enableBrowserNotifications(): void {
    this.browserNotifications.enableBrowserNotifications();
  }

  private readHabitForm(): HabitUpsertRequest {
    const value = this.habitForm.getRawValue();

    return {
      title: value.title.trim(),
      description: value.description.trim(),
      category: value.category as PersistedHabitCategory,
      difficulty: value.difficulty as PersistedHabitDifficulty,
      frequency: value.frequency as PersistedHabitFrequency
    };
  }

  private saveReminderForHabit(habitId: string): Observable<HabitReminderResponse | null> {
    const value = this.habitForm.getRawValue();

    if (!value.reminderEnabled && !this.editingReminderExists()) {
      return of(null);
    }

    const request = this.readReminderRequest();

    this.reminderSaving.set(true);
    this.reminderError.set(null);

    return this.reminderApi.upsert(habitId, request).pipe(
      tap((response) => this.editingReminderExists.set(response.id !== null)),
      finalize(() => this.reminderSaving.set(false))
    );
  }

  private readReminderRequest(): UpsertHabitReminderRequest {
    const value = this.habitForm.getRawValue();

    return {
      isEnabled: value.reminderEnabled,
      time: value.reminderEnabled ? value.reminderTime : null,
      timeZoneId: value.reminderEnabled ? value.reminderTimeZoneId : null,
      daysOfWeek: value.reminderEnabled ? value.reminderDaysOfWeek : null
    };
  }

  private loadReminderForHabit(habitId: string): void {
    this.reminderLoading.set(true);
    this.reminderError.set(null);

    this.reminderApi
      .get(habitId)
      .pipe(
        finalize(() => {
          if (this.editingHabitId() === habitId) {
            this.reminderLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (reminder) => {
          if (this.editingHabitId() !== habitId) {
            return;
          }

          this.applyReminder(reminder);
        },
        error: (error: unknown) => {
          if (this.editingHabitId() === habitId) {
            this.reminderError.set(this.describeReminderError(error));
          }
        }
      });
  }

  private applyReminder(reminder: HabitReminderResponse): void {
    this.editingReminderExists.set(reminder.id !== null);
    this.habitForm.patchValue({
      reminderEnabled: reminder.isEnabled,
      reminderTime: reminder.time ?? DEFAULT_REMINDER_TIME,
      reminderTimeZoneId: reminder.timeZoneId ?? this.browserTimeZoneId,
      reminderDaysOfWeek:
        this.filterReminderDays(reminder.daysOfWeek).length > 0
          ? this.filterReminderDays(reminder.daysOfWeek)
          : [...REMINDER_DAYS]
    });
    this.updateReminderValidators(reminder.isEnabled);
  }

  private updateReminderValidators(enabled: boolean): void {
    const timeControl = this.habitForm.controls.reminderTime;
    const timeZoneControl = this.habitForm.controls.reminderTimeZoneId;
    const daysControl = this.habitForm.controls.reminderDaysOfWeek;

    timeControl.setValidators(enabled
      ? [
          Validators.required,
          Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
        ]
      : []);
    timeZoneControl.setValidators(enabled ? [Validators.required] : []);
    daysControl.setValidators(enabled ? [this.validateReminderDays] : []);

    timeControl.updateValueAndValidity({ emitEvent: false });
    timeZoneControl.updateValueAndValidity({ emitEvent: false });
    daysControl.updateValueAndValidity({ emitEvent: false });
  }

  private validateReminderDays(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    return Array.isArray(value) && value.length > 0
      ? null
      : { reminderDaysRequired: true };
  }

  private filterReminderDays(days: readonly string[]): ReminderDay[] {
    const validDays = new Set<string>(REMINDER_DAYS);

    return days.filter((day): day is ReminderDay => validDays.has(day));
  }

  private formatReminderDays(days: readonly ReminderDay[]): string {
    if (days.length === REMINDER_DAYS.length) {
      return 'Every day';
    }

    if (days.length === 1) {
      return days[0] ?? '';
    }

    if (days.length === 2) {
      return `${days[0]} and ${days[1]}`;
    }

    return `${days.slice(0, -1).join(', ')} and ${days.at(-1)}`;
  }

  private formatReminderTime(time: string): string {
    const [hourValue, minuteValue] = time.split(':');
    const hour = Number(hourValue);
    const minute = Number(minuteValue);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return time;
    }

    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private resolveBrowserTimeZoneId(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
        || FALLBACK_TIME_ZONE_ID;
    } catch {
      return FALLBACK_TIME_ZONE_ID;
    }
  }

  private resolveTimeZoneOptions(): readonly string[] {
    const intlWithTimeZones = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    };
    const supportedTimeZones =
      intlWithTimeZones.supportedValuesOf?.('timeZone') ?? COMMON_TIME_ZONE_IDS;

    return Array.from(new Set([
      this.browserTimeZoneId,
      ...supportedTimeZones,
      FALLBACK_TIME_ZONE_ID
    ])).sort((first, second) => first.localeCompare(second));
  }

  private describeReminderError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Reminder failed to save.';
    }

    if (error.status === 0) {
      return 'The backend is unavailable. Your habit values are still here.';
    }

    const problem = this.isRecord(error.error) ? error.error : null;
    const errors = problem && this.isRecord(problem['errors'])
      ? problem['errors']
      : null;
    const firstValidationError = errors
      ? Object.values(errors).find((value): value is string[] =>
          Array.isArray(value) && value.every((item) => typeof item === 'string')
        )?.[0]
      : null;

    if (firstValidationError) {
      return firstValidationError;
    }

    const detail = problem?.['detail'];

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }

    return 'Reminder failed to save.';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
