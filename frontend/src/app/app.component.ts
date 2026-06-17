import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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
  protected readonly navItems: readonly NavItem[] = PROTOTYPE_ROUTE_CONFIGS.map(
    ({ navLabel, path }) => ({
      label: navLabel,
      path: `/${path}` as NavPath
    })
  );
}
