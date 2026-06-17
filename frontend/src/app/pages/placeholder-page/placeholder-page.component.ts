import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './placeholder-page.component.html',
  styleUrls: ['./placeholder-page.component.css']
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly area = this.route.snapshot.data['area'] as string;
  protected readonly description = this.route.snapshot.data['description'] as string;
}
