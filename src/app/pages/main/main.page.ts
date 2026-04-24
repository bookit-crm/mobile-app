import { Component, inject, OnInit } from '@angular/core';
import { take } from 'rxjs';
import { SupervisorService } from '@core/services/supervisor.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
})
export class MainPage implements OnInit {
  private supervisorService = inject(SupervisorService);

  ngOnInit(): void {
    this.supervisorService.getSelf().pipe(take(1)).subscribe();
  }
}

