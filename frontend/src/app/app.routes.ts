import { Routes } from '@angular/router';

import { LandingComponent } from './pages/landing/landing.component';
import { PlaceholderPageComponent } from './pages/placeholder-page/placeholder-page.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
    title: 'LevelHabit'
  },
  {
    path: 'dashboard',
    component: PlaceholderPageComponent,
    title: 'Dashboard | LevelHabit',
    data: {
      area: 'Dashboard',
      description: 'Future home for the authenticated player overview, active quests, hero status, and daily progress.'
    }
  },
  {
    path: 'quests',
    component: PlaceholderPageComponent,
    title: 'Quests | LevelHabit',
    data: {
      area: 'Quests',
      description: 'Future home for creating, scheduling, and completing habit quests.'
    }
  },
  {
    path: 'hero',
    component: PlaceholderPageComponent,
    title: 'Hero | LevelHabit',
    data: {
      area: 'Hero',
      description: 'Future home for profile progression, levels, titles, and hero customization.'
    }
  },
  {
    path: 'achievements',
    component: PlaceholderPageComponent,
    title: 'Achievements | LevelHabit',
    data: {
      area: 'Achievements',
      description: 'Future home for unlocked badges, milestones, and mastery rewards.'
    }
  },
  {
    path: 'analytics',
    component: PlaceholderPageComponent,
    title: 'Analytics | LevelHabit',
    data: {
      area: 'Analytics',
      description: 'Future home for habit consistency, streak trends, and long-term progress insights.'
    }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
