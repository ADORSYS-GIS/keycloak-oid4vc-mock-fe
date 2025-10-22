import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';
import { runtimeEnvironment } from '../config/runtime-environment';

@Injectable({
  providedIn: 'root',
})
export class KeycloakWrapperService {
  private keycloakInstance: Keycloak | undefined;

  async init(): Promise<boolean> {
    this.keycloakInstance = new Keycloak({
      url: runtimeEnvironment.keycloak.url,
      realm: runtimeEnvironment.keycloak.realm,
      clientId: runtimeEnvironment.keycloak.clientId,
    });

    try {
      const authenticated = await this.keycloakInstance.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        redirectUri: window.location.origin + '/callback',
        checkLoginIframe: false,
      });
      console.log('Keycloak initialized. Authenticated:', authenticated);
      return authenticated;
    } catch (error) {
      console.error('Keycloak initialization error:', error);
      return false;
    }
  }

  isLoggedIn(): boolean {
    return !!this.keycloakInstance?.authenticated;
  }

  getToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.keycloakInstance?.token) {
        resolve(this.keycloakInstance.token);
      } else {
        reject(new Error('No Keycloak token available.'));
      }
    });
  }

  async getUserInfo(): Promise<Keycloak.KeycloakProfile | undefined> {
    return await this.keycloakInstance?.loadUserProfile();
  }

  login(options?: Keycloak.KeycloakLoginOptions): Promise<void> {
    return (
      this.keycloakInstance?.login(options) ||
      Promise.reject(new Error('Keycloak not initialized.'))
    );
  }

  logout(redirectUri?: string): Promise<void> {
    return (
      this.keycloakInstance?.logout(redirectUri ? { redirectUri } : undefined) ||
      Promise.reject(new Error('Keycloak not initialized.'))
    );
  }

  get instance(): Keycloak | undefined {
    return this.keycloakInstance;
  }
}
