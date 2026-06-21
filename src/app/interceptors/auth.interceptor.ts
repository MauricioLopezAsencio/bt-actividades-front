import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpErrorResponse, HttpEvent
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private refreshing = false;

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    const isLoginUrl = req.url.includes('auth/login');

    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      tap(() => {
        if (!isLoginUrl && !this.refreshing) {
          const minutos = this.authService.minutosParaExpirar();
          if (minutos !== Infinity && minutos < 10 && minutos > 0) {
            this.refreshing = true;
            this.authService.refresh().subscribe({
              next: () => { this.refreshing = false; },
              error: () => { this.refreshing = false; }
            });
          }
        }
      }),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 && !isLoginUrl) {
          this.authService.logout();
          Swal.fire({
            html: '<p style="color:#fff;font-size:1rem;margin:0">Tu sesión ha expirado,<br>vuelve a iniciar sesión.</p>',
            icon: 'warning',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
          });
        }
        return throwError(() => err);
      })
    );
  }
}
