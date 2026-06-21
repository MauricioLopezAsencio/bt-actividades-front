import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { Constants } from '../utils/Constants';

export interface AuthData {
  token: string;
  username: string;
  expiresAt: string; // ISO-8601
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly TOKEN_KEY      = 'bt_token';
  private readonly USERNAME_KEY   = 'bt_username';
  private readonly EXPIRES_AT_KEY = 'bt_expires_at';
  private readonly PASSWORD_KEY   = 'bt_pwd';

  constructor(private http: HttpClient, private router: Router) {}

  login(user: string, password: string): Observable<ApiResponse<AuthData>> {
    return this.http.post<ApiResponse<AuthData>>(
      `${Constants.baseUrl}auth/login`,
      { user, password }
    ).pipe(
      tap(res => {
        const data = res?.data ?? (res as any);
        if (data?.token) {
          localStorage.setItem(this.TOKEN_KEY,      data.token);
          localStorage.setItem(this.USERNAME_KEY,   data.username ?? user);
          if (data.expiresAt) {
            localStorage.setItem(this.EXPIRES_AT_KEY, data.expiresAt);
          }
          sessionStorage.setItem(this.PASSWORD_KEY, password);
        }
      })
    );
  }

  refresh(): Observable<ApiResponse<AuthData>> {
    return this.http.post<ApiResponse<AuthData>>(
      `${Constants.baseUrl}auth/refresh`,
      {}
    ).pipe(
      tap(res => {
        const data = res?.data ?? (res as any);
        if (data?.token) {
          localStorage.setItem(this.TOKEN_KEY, data.token);
          if (data.expiresAt) {
            localStorage.setItem(this.EXPIRES_AT_KEY, data.expiresAt);
          }
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    localStorage.removeItem(this.EXPIRES_AT_KEY);
    sessionStorage.removeItem(this.PASSWORD_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY);
  }

  getPassword(): string | null {
    return sessionStorage.getItem(this.PASSWORD_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** @deprecated use isLoggedIn() */
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  minutosParaExpirar(): number {
    const raw = localStorage.getItem(this.EXPIRES_AT_KEY);
    if (!raw) return Infinity;
    const diff = new Date(raw).getTime() - Date.now();
    return diff > 0 ? Math.floor(diff / 60_000) : 0;
  }
}
