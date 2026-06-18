import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { PROTOTYPE_ROUTE_CONFIGS } from './pages/prototype-page/prototype-view.model';

const loadAuthPage = () =>
  import('./pages/auth-page/auth-page.component').then(
    (component) => component.AuthPageComponent
  );

const loadPrototypePage = () =>
  import('./pages/prototype-page/prototype-page.component').then(
    (component) => component.PrototypePageComponent
  );

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: loadAuthPage,
    title: 'Sign in | LevelHabit',
    data: {
      mode: 'login'
    }
  },
  {
    path: 'register',
    loadComponent: loadAuthPage,
    title: 'Create account | LevelHabit',
    data: {
      mode: 'register'
    }
  },
  {
    path: 'profile',
    redirectTo: 'hero',
    pathMatch: 'full'
  },
  ...PROTOTYPE_ROUTE_CONFIGS.map(({ path, title }) => ({
    path,
    loadComponent: loadPrototypePage,
    title: `${title} | LevelHabit`,
    canActivate: [authGuard],
    data: {
      view: path
    }
  })),
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
