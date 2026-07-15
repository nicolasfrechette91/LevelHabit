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
    data: {
      titleKey: 'routes.login',
      mode: 'login'
    }
  },
  {
    path: 'register',
    loadComponent: loadAuthPage,
    data: {
      titleKey: 'routes.register',
      mode: 'register'
    }
  },
  {
    path: 'forgot-password',
    loadComponent: loadForgotPasswordPage,
    data: { titleKey: 'routes.forgotPassword' }
  },
  {
    path: 'reset-password',
    loadComponent: loadResetPasswordPage,
    data: { titleKey: 'routes.resetPassword' }
  },
  {
    path: 'verify-email',
    loadComponent: loadVerifyEmailPage,
    data: { titleKey: 'routes.verifyEmail' }
  },
  {
    path: 'profile',
    redirectTo: 'progress',
    pathMatch: 'full'
  },
  ...PROTOTYPE_ROUTE_CONFIGS.map(({ path, titleKey }) => ({
    path,
    loadComponent: loadPrototypePage,
    canActivate: [authGuard],
    data: {
      layout: 'authenticated',
      titleKey,
      view: path
    }
  })),
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
