export const Constants = {
    baseUrl: 'https://bt-actividades.onrender.com/api/v1/',
    //baseUrl: 'https://bitacora-back-end.onrender.com/api/v1/',
    //baseUrl: 'http://localhost:3000/api/v1/',   // backend local
    //baseUrl: 'https://colored-evaluated-officially-buttons.trycloudflare.com/api/v1/',

    // ── Configuración de Azure AD para MSAL ──────────────────────────────────
    // Registra una app en https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
    // y agrega el permiso delegado "Calendars.Read" de Microsoft Graph.
    msal: {
        clientId:    'TU_CLIENT_ID_DE_AZURE_AD',
        tenantId:    'TU_TENANT_ID_DE_AZURE_AD',
        redirectUri: window.location.origin          // http://localhost:4200 en dev
    }
}

