import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

type NavItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  protected readonly navItems: NavItem[] = [
    { label: 'Today', path: '/dashboard' },
    { label: 'Quests', path: '/quests' },
    { label: 'Hero', path: '/hero' },
    { label: 'Achievements', path: '/achievements' },
    { label: 'Analytics', path: '/analytics' }
  ];
}
