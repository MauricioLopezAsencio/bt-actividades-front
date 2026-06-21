import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class InactivityService {

  readonly showWarning$ = new BehaviorSubject<boolean>(false);

  private readonly WARN_MS   = 25 * 60 * 1000; // 25 min
  private readonly LOGOUT_MS = 30 * 60 * 1000; // 30 min
  private readonly EVENTS    = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

  private warnTimer:   ReturnType<typeof setTimeout> | null = null;
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly boundReset = () => this.reset();

  constructor(private authService: AuthService) {}

  start(): void {
    this.EVENTS.forEach(e =>
      window.addEventListener(e, this.boundReset, { passive: true })
    );
    this.scheduleTimers();
  }

  stop(): void {
    this.EVENTS.forEach(e =>
      window.removeEventListener(e, this.boundReset)
    );
    this.clearTimers();
    this.showWarning$.next(false);
  }

  reset(): void {
    this.showWarning$.next(false);
    this.clearTimers();
    this.scheduleTimers();
  }

  private scheduleTimers(): void {
    this.warnTimer   = setTimeout(() => this.showWarning$.next(true),        this.WARN_MS);
    this.logoutTimer = setTimeout(() => this.authService.logout(),           this.LOGOUT_MS);
  }

  private clearTimers(): void {
    if (this.warnTimer)   { clearTimeout(this.warnTimer);   this.warnTimer   = null; }
    if (this.logoutTimer) { clearTimeout(this.logoutTimer); this.logoutTimer = null; }
  }
}
