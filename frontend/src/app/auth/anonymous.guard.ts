import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { environment } from '../../environments/environment';
import { BackendStatusService } from '../core/services/backend-status.service';
import { AuthService } from './auth.service';

export const anonymousGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const backend = inject(BackendStatusService);
  const router = inject(Router);

  if (!environment.authRequired) {
    return true;
  }

  return backend.whenAvailable().pipe(
    switchMap(() => auth.initializeAuth()),
    map((status) =>
      status === 'authenticated'
        ? router.createUrlTree(['/dashboard'])
        : true
    ),
    catchError(() => of(true))
  );
};
