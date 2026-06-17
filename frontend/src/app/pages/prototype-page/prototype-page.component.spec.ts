import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_COMPLETED_IDS,
  PROTOTYPE_QUESTS,
  PROTOTYPE_TITLES
} from '../../state/levelhabit-prototype-data';
import {
  getButtonByText,
  getQuestToggle,
  renderPrototypeRoute,
  resetPrototypeStorage,
  textContent
} from '../../test/prototype-test-utils';

describe('Prototype routes', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it.each([
    ['/dashboard', 'Quest queue'],
    ['/quests', 'shown'],
    ['/hero', 'Player profile'],
    ['/achievements', 'Unlocked'],
    ['/analytics', 'XP output']
  ])('renders %s without errors', async (path, expectedContent) => {
    const { nativeElement } = await renderPrototypeRoute(path);

    expect(textContent(nativeElement)).toContain(expectedContent);
  });
});

describe('Dashboard view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays mock hero/profile data and the quest queue', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(`Level ${state.level()}`);
    expect(pageText).toContain(PROTOTYPE_TITLES[0]);
    expect(pageText).toContain(`${state.completedCount()}/${state.questCount()}`);

    for (const quest of PROTOTYPE_QUESTS) {
      expect(pageText).toContain(quest.title);
    }
  });

  it('updates rendered completion and XP when completing a quest', async () => {
    const { harness, nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const quest = PROTOTYPE_QUESTS.find(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    );

    expect(quest).toBeDefined();

    const startingXp = state.totalXp();
    getQuestToggle(nativeElement, quest!.title).click();
    harness.detectChanges();

    const pageText = textContent(nativeElement);

    expect(state.quests().find((candidate) => candidate.id === quest!.id)?.completed).toBe(true);
    expect(state.totalXp()).toBe(startingXp + quest!.xp);
    expect(pageText).toContain(`${state.completedCount()}/${state.questCount()}`);
    expect(pageText).toContain(state.totalXp().toLocaleString('en-US'));
  });
});

describe('Achievements view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays locked and unlocked achievements', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/achievements');
    const badges = Array.from(nativeElement.querySelectorAll('.achievement-state')).map(textContent);

    expect(state.achievements().some((achievement) => achievement.unlocked)).toBe(true);
    expect(state.achievements().some((achievement) => !achievement.unlocked)).toBe(true);
    expect(badges).toContain('Unlocked');
    expect(badges).toContain('Locked');
  });
});

describe('Quests view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('filters visible quests by completion state', async () => {
    const { harness, nativeElement, state } = await renderPrototypeRoute('/quests');
    const completedQuest = state.quests().find((quest) => quest.completed);
    const activeQuest = state.quests().find((quest) => !quest.completed);

    expect(completedQuest).toBeDefined();
    expect(activeQuest).toBeDefined();

    expect(textContent(nativeElement)).toContain(activeQuest!.title);
    expect(textContent(nativeElement)).not.toContain(completedQuest!.title);

    getButtonByText(nativeElement, /^All$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain(completedQuest!.title);

    getButtonByText(nativeElement, /^Done$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain(completedQuest!.title);
    expect(textContent(nativeElement)).not.toContain(activeQuest!.title);
  });
});
