import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  BASE_XP,
  DEFAULT_COMPLETED_IDS,
  PROTOTYPE_QUESTS
} from './levelhabit-prototype-data';
import { LevelHabitStateService } from './levelhabit-state.service';

describe('LevelHabitStateService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    localStorage.clear();
  });

  it('starts from the centralized prototype quest data', () => {
    const state = TestBed.inject(LevelHabitStateService);

    expect(state.quests()).toHaveLength(PROTOTYPE_QUESTS.length);
    expect(state.completedCount()).toBe(DEFAULT_COMPLETED_IDS.length);
    expect(state.totalXp()).toBe(
      BASE_XP +
        PROTOTYPE_QUESTS
          .filter((quest) => DEFAULT_COMPLETED_IDS.includes(quest.id))
          .reduce((total, quest) => total + quest.xp, 0)
    );
  });

  it('updates completion, XP, and level progress when a mock quest is completed', () => {
    const state = TestBed.inject(LevelHabitStateService);
    const quest = PROTOTYPE_QUESTS.find(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    );

    expect(quest).toBeDefined();

    const startingXp = state.totalXp();
    const startingProgress = state.levelProgress();

    state.toggleQuest(quest!.id);

    expect(state.quests().find((candidate) => candidate.id === quest!.id)?.completed).toBe(true);
    expect(state.totalXp()).toBe(startingXp + quest!.xp);
    expect(state.levelProgress()).toBeGreaterThan(startingProgress);
  });
});
