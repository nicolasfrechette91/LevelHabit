import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const loginTree = () =>
    router.createUrlTree(['/login'], {
      queryParams: {
        returnUrl: state.url
      }
    });

  if (!environment.authRequired) {
    return true;
  }

  if (!auth.hasToken()) {
    return loginTree();
  }

  return auth.ensureCurrentUser().pipe(
    map(() => true),
    catchError(() => {
      auth.logout();
      return of(loginTree());
    })
  );
};
