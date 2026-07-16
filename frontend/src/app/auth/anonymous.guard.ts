import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const anonymousGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!environment.authRequired) {
    return true;
  }

  return auth.initializeAuth().pipe(
    map((status) =>
      status === 'authenticated'
        ? router.createUrlTree(['/dashboard'])
        : true
    ),
    catchError(() => of(true))
  );
};
