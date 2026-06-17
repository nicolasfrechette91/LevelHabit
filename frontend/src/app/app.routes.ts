import { Routes } from '@angular/router';

import { PROTOTYPE_ROUTE_CONFIGS } from './pages/prototype-page/prototype-view.model';

const loadPrototypePage = () =>
  import('./pages/prototype-page/prototype-page.component').then(
    (component) => component.PrototypePageComponent
  );

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  ...PROTOTYPE_ROUTE_CONFIGS.map(({ path, title }) => ({
    path,
    loadComponent: loadPrototypePage,
    title: `${title} | LevelHabit`,
    data: {
      view: path
    }
  })),
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
