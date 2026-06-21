import { Injectable, NgZone } from '@angular/core';
import {
  PublicClientApplication,
  Configuration,
  BrowserAuthErrorCodes,
  InteractionRequiredAuthError
} from '@azure/msal-browser';
import { Constants } from '../utils/Constants';

const CALENDAR_SCOPE = 'https://graph.microsoft.com/Calendars.Read';

@Injectable({ providedIn: 'root' })
export class MsalAuthService {

  private msalInstance: PublicClientApplication;
  private initPromise: Promise<void>;

  constructor(private ngZone: NgZone) {
    const config: Configuration = {
      auth: {
        clientId:    Constants.msal.clientId,
        authority:   `https://login.microsoftonline.com/${Constants.msal.tenantId}`,
        redirectUri: Constants.msal.redirectUri
      },
      cache: { cacheLocation: 'sessionStorage' }
    };

    this.msalInstance = new PublicClientApplication(config);

    // handleRedirectPromise es obligatorio después de initialize() en MSAL v3+
    // para resolver cualquier flujo de redirect pendiente al cargar la página
    this.initPromise = this.msalInstance.initialize()
      .then(() => this.msalInstance.handleRedirectPromise())
      .then(() => undefined);
  }

  // ─── Obtener token ────────────────────────────────────────────────────────

  async acquireToken(): Promise<string> {
    await this.initPromise;

    const scopes = [CALENDAR_SCOPE];
    const accounts = this.msalInstance.getAllAccounts();

    // Intento silencioso si ya existe una cuenta en caché
    if (accounts.length > 0) {
      this.msalInstance.setActiveAccount(accounts[0]);
      try {
        const result = await this.msalInstance.acquireTokenSilent({
          scopes,
          account: accounts[0]
        });
        return result.accessToken;
      } catch (err: unknown) {
        // Solo hacemos popup si el error requiere interacción (token expirado,
        // consentimiento pendiente, etc.); cualquier otro error se propaga
        if (!(err instanceof InteractionRequiredAuthError)) {
          throw err;
        }
      }
    }

    // Popup dentro de ngZone para que Angular detecte los cambios al completar
    return this.ngZone.run(() => this.loginPopupWithRetry(scopes));
  }

  // ─── Popup con reintenio si hay estado sucio ──────────────────────────────

  private async loginPopupWithRetry(scopes: string[]): Promise<string> {
    try {
      return await this.doPopup(scopes);
    } catch (err: any) {
      // interaction_in_progress: MSAL dejó un flag en sessionStorage de una
      // interacción anterior que no completó. Limpiamos y reintentamos una vez.
      if (err?.errorCode === BrowserAuthErrorCodes.interactionInProgress) {
        this.clearInteractionState();
        return this.doPopup(scopes);
      }
      throw err;
    }
  }

  private async doPopup(scopes: string[]): Promise<string> {
    const result = await this.msalInstance.loginPopup({
      scopes,
      prompt: 'select_account'
    });
    if (result.account) {
      this.msalInstance.setActiveAccount(result.account);
    }
    return result.accessToken;
  }

  // Elimina las claves de sessionStorage que MSAL usa para rastrear
  // interacciones en curso (evita el error interaction_in_progress)
  private clearInteractionState(): void {
    Object.keys(sessionStorage)
      .filter(k =>
        k.includes('interaction.status') ||
        k.endsWith('.request.params')
      )
      .forEach(k => sessionStorage.removeItem(k));
  }

  // ─── Info de cuenta ───────────────────────────────────────────────────────

  async getAccountName(): Promise<string | null> {
    await this.initPromise;
    const account =
      this.msalInstance.getActiveAccount() ??
      this.msalInstance.getAllAccounts()[0] ??
      null;
    return account?.name ?? account?.username ?? null;
  }

  // ─── Cerrar sesión ────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    await this.initPromise;
    const account =
      this.msalInstance.getActiveAccount() ??
      this.msalInstance.getAllAccounts()[0];
    if (account) {
      await this.ngZone.run(() =>
        this.msalInstance.logoutPopup({ account })
      );
    }
  }
}
