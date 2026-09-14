import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth/auth.interceptor';
import { ConversaStore } from './core/ia/persistencia/conversa-store';
import { ConversaStoreIdb } from './core/ia/persistencia/conversa-store-idb';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Histórico do assistente. Trocar por um ConversaStoreHttp é só mudar esta linha.
    { provide: ConversaStore, useExisting: ConversaStoreIdb },
  ],
};
