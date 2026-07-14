import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
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

import { AuthService } from './auth/auth.service';
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
    NotificationCenterComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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

  protected readonly navItems: readonly NavItem[] = PROTOTYPE_ROUTE_CONFIGS.map(
    ({ navLabel, path }) => ({
      label: navLabel,
      path: `/${path}` as NavPath
    })
  );

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
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
}
