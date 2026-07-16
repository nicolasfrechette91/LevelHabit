import { NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Meta, Title } from '@angular/platform-browser';

import { AuthService } from './auth/auth.service';
import { TranslatePipe } from './i18n/i18n.pipes';
import { LanguageSelectorComponent } from './i18n/language-selector.component';
import { LanguageService } from './i18n/language.service';
import { NotificationCenterComponent } from './notifications/notification-center.component';
import {
  PROTOTYPE_ROUTE_CONFIGS,
  type PrototypeView
} from './pages/prototype-page/prototype-view.model';

type NavPath = `/${PrototypeView}`;
type NavItem = {
  label: string;
  path: NavPath;
};

@Component({
  selector: 'app-root',
  imports: [
    NgOptimizedImage,
    LanguageSelectorComponent,
    NotificationCenterComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ),
    { initialValue: null }
  );

  protected readonly isLoggingOut = signal(false);
  protected readonly isHeaderInitializing = computed(
    () =>
      this.auth.isCheckingAuth()
      || this.isLoggingOut()
      || (!this.router.navigated && this.navigation() === null)
  );

  protected readonly usesAuthenticatedLayout = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.hasAuthenticatedLayout()),
      startWith(this.hasAuthenticatedLayout())
    ),
    {
      initialValue: this.hasAuthenticatedLayout()
    }
  );

  protected readonly isLoginPage = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split(/[?#]/, 1)[0] === '/login'),
      startWith(this.router.url.split(/[?#]/, 1)[0] === '/login')
    ),
    {
      initialValue: this.router.url.split(/[?#]/, 1)[0] === '/login'
    }
  );

  protected readonly navItems: readonly NavItem[] = PROTOTYPE_ROUTE_CONFIGS.map(
    ({ navLabelKey, path }) => ({
      label: navLabelKey,
      path: `/${path}` as NavPath
    })
  );

  private readonly synchronizeDocumentMetadata = effect(() => {
    this.navigation();
    this.language.currentLanguage();
    const titleKey = this.deepestRouteData('titleKey') ?? 'routes.login';

    this.title.setTitle(this.language.translate(titleKey));
    this.meta.updateTag({
      name: 'description',
      content: this.language.translate('common.metaDescription')
    });
  });

  protected logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.auth.logout().subscribe({
      complete: () => this.navigateToLoginAfterLogout(),
      error: () => this.navigateToLoginAfterLogout()
    });
  }

  private navigateToLoginAfterLogout(): void {
    void this.router.navigateByUrl('/login', { replaceUrl: true }).then(
      () => this.isLoggingOut.set(false),
      () => this.isLoggingOut.set(false)
    );
  }

  private hasAuthenticatedLayout(): boolean {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;

    while (route) {
      if (route.data['layout'] === 'authenticated') {
        return true;
      }

      route = route.firstChild;
    }

    return false;
  }

  private deepestRouteData(key: string): string | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let value: string | null = null;

    while (route) {
      const candidate = route.data[key];

      if (typeof candidate === 'string') {
        value = candidate;
      }

      route = route.firstChild;
    }

    return value;
  }
}
