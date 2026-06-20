import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { SKIP_AUTH_REFRESH } from './auth-http.context';
import { AuthService } from './auth.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApiRequest =
    request.url.startsWith(environment.apiUrl) ||
    request.url.startsWith('/api');
  const accessToken = auth.accessToken();
  const requestWithAuth =
    accessToken && shouldAttachAccessToken(request, isApiRequest)
      ? withBearerToken(request, accessToken)
      : request;

  return next(requestWithAuth).pipe(
    catchError((error: unknown) => {
      if (!shouldRefresh(error, requestWithAuth, isApiRequest, auth)) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        catchError((refreshError: unknown) => {
          auth.clearSession();
          void router.navigateByUrl('/login');

          return throwError(() => refreshError);
        }),
        switchMap(() => {
          const nextAccessToken = auth.accessToken();

          if (!nextAccessToken) {
            return throwError(() => error);
          }

          return next(
            withBearerToken(
              request.clone({
                context: request.context.set(SKIP_AUTH_REFRESH, true)
              }),
              nextAccessToken
            )
          );
        })
      );
    })
  );
};

function shouldRefresh(
  error: unknown,
  request: HttpRequest<unknown>,
  isApiRequest: boolean,
  auth: AuthService
): error is HttpErrorResponse {
  return (
    error instanceof HttpErrorResponse
    && error.status === 401
    && isApiRequest
    && !request.context.get(SKIP_AUTH_REFRESH)
    && !isAuthLifecycleEndpoint(request)
    && auth.hasRefreshToken()
  );
}

function shouldAttachAccessToken(
  request: HttpRequest<unknown>,
  isApiRequest: boolean
): boolean {
  return isApiRequest && !isAuthLifecycleEndpoint(request);
}

function withBearerToken(
  request: HttpRequest<unknown>,
  accessToken: string
): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

function isAuthLifecycleEndpoint(request: HttpRequest<unknown>): boolean {
  return ['login', 'register', 'refresh', 'logout'].some((endpoint) =>
    request.url.split('?')[0]?.endsWith(`/auth/${endpoint}`)
  );
}
