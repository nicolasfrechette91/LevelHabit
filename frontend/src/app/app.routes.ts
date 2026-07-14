import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { PROTOTYPE_ROUTE_CONFIGS } from './pages/prototype-page/prototype-view.model';

const loadAuthPage = () =>
  import('./pages/auth-page/auth-page.component').then(
    (component) => component.AuthPageComponent
  );

const loadForgotPasswordPage = () =>
  import('./pages/forgot-password-page/forgot-password-page.component').then(
    (component) => component.ForgotPasswordPageComponent
  );

const loadResetPasswordPage = () =>
  import('./pages/reset-password-page/reset-password-page.component').then(
    (component) => component.ResetPasswordPageComponent
  );

const loadVerifyEmailPage = () =>
  import('./pages/verify-email-page/verify-email-page.component').then(
    (component) => component.VerifyEmailPageComponent
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
    path: 'forgot-password',
    loadComponent: loadForgotPasswordPage,
    title: 'Forgot password | LevelHabit'
  },
  {
    path: 'reset-password',
    loadComponent: loadResetPasswordPage,
    title: 'Reset password | LevelHabit'
  },
  {
    path: 'verify-email',
    loadComponent: loadVerifyEmailPage,
    title: 'Verify email | LevelHabit'
  },
  {
    path: 'profile',
    redirectTo: 'progress',
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
