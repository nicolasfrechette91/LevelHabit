import { Routes } from '@angular/router';

import { PrototypePageComponent } from './pages/prototype-page/prototype-page.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: PrototypePageComponent,
    title: 'Dashboard | LevelHabit',
    data: {
      view: 'dashboard'
    }
  },
  {
    path: 'quests',
    component: PrototypePageComponent,
    title: 'Quests | LevelHabit',
    data: {
      view: 'quests'
    }
  },
  {
    path: 'hero',
    component: PrototypePageComponent,
    title: 'Hero | LevelHabit',
    data: {
      view: 'hero'
    }
  },
  {
    path: 'achievements',
    component: PrototypePageComponent,
    title: 'Achievements | LevelHabit',
    data: {
      view: 'achievements'
    }
  },
  {
    path: 'analytics',
    component: PrototypePageComponent,
    title: 'Analytics | LevelHabit',
    data: {
      view: 'analytics'
    }
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
