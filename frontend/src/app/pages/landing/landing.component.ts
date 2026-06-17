import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';

type Pillar = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent {
  protected readonly apiHealthUrl = `${environment.apiBaseUrl}/health`;

  protected readonly pillars: Pillar[] = [
    {
      title: 'Complete habits',
      description: 'Turn daily routines into focused quests that can be checked off with intention.'
    },
    {
      title: 'Earn XP',
      description: 'Reward consistency with progression points that make small wins feel visible.'
    },
    {
      title: 'Build streaks',
      description: 'Keep momentum alive with streak tracking designed for durable behavior change.'
    },
    {
      title: 'Level up',
      description: 'Grow a personal hero profile as habits compound into long-term progress.'
    }
  ];
}
