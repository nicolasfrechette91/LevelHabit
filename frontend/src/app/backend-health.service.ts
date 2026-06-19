import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BackendHealthService {
  private readonly http = inject(HttpClient);
  private warmUpRequest$: Observable<boolean> | null = null;

  warmUp(): Observable<boolean> {
    this.warmUpRequest$ ??= this.http
      .get(`${environment.apiUrl}/health`, { responseType: 'text' })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    return this.warmUpRequest$;
  }
}
