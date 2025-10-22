import { provideHttpClient } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { KeycloakWrapperService } from './services/keycloak-wrapper.service';

import { routes } from './app.routes';

// Function to initialize Keycloak
function initializeKeycloak(keycloak: KeycloakWrapperService) {
  return () =>
    keycloak.init().catch((error: unknown) => {
      console.error('Keycloak initialization error:', error);
      // Return a resolved promise to continue app initialization even if Keycloak fails
      return Promise.resolve();
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    KeycloakWrapperService, // Provide the new wrapper service
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      multi: true,
      deps: [KeycloakWrapperService],
    },
  ],
};
