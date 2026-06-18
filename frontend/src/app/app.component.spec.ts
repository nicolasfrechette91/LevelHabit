import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { AUTH_STORAGE_KEY } from './auth/auth.service';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'test-access-token',
        expiresAtUtc: '2099-01-01T00:00:00Z'
      })
    );
  });

  it('renders the app shell, brand, and primary navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes), provideHttpClient()]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.app-shell')).not.toBeNull();
    expect(element.querySelector('.navbar-brand')?.textContent).toContain('LevelHabit');
    expect(element.querySelectorAll('nav a')).toHaveLength(5);
  });
});
