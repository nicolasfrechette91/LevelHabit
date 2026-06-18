import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './auth/auth.service';
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
  imports: [NgOptimizedImage, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
}
