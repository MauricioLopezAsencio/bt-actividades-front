import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { InactivityService } from './services/inactivity.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  isLoginPage = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private inactivity: InactivityService
  ) {
    if (this.authService.isLoggedIn()) {
      this.inactivity.start();
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isLoginPage = e.urlAfterRedirects === '/login';

      if (e.urlAfterRedirects === '/login') {
        this.inactivity.stop();
      } else if (this.authService.isLoggedIn()) {
        this.inactivity.start();
      }
    });
  }

  logout(): void {
    this.inactivity.stop();
    this.authService.logout();
  }
}
