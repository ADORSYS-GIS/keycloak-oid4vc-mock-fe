// src/app/services/oid4vc.service.ts
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { runtimeEnvironment } from '../config/runtime-environment';
import { KeycloakWrapperService } from './keycloak-wrapper.service';

interface CredentialOfferUriResponse {
  credential_offer_uri?: string;
  issuer?: string;
  nonce?: string;
}

interface CredentialOffer {
  credential_issuer?: string;
  [key: string]: unknown;
}

export enum CredentialConfigurationId {
  KMA = 'KMACredential',
}

export const DEFAULT_CREDENTIAL_CONFIGURATION_ID =
  runtimeEnvironment.oid4vc?.defaultCredentialConfigurationId || CredentialConfigurationId.KMA;

@Injectable({ providedIn: 'root' })
export class Oid4vcService {
  private http = inject(HttpClient);
  private kc = inject(KeycloakWrapperService);

  // No constructor needed when using inject()

  private async authHeaders(): Promise<HttpHeaders> {
    const token = await this.kc.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    });
  }

  // Handle both development and production environments
  private base(): string {
    return `${runtimeEnvironment.keycloak.url}/realms/${runtimeEnvironment.keycloak.realm}`;
  }

  async getCredentialOfferUri(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<string> {
    try {
      const headers = await this.authHeaders();
      const url = `${this.base()}/protocol/oid4vc/credential-offer-uri?credential_configuration_id=${encodeURIComponent(credentialConfigurationId)}`;

      const res = await firstValueFrom(
        this.http.get<string | CredentialOfferUriResponse>(url, { headers }),
      );

      if (typeof res === 'string') return res;
      if (res?.credential_offer_uri) return res.credential_offer_uri;
      if (res?.issuer && res?.nonce) return `${res.issuer}${res.nonce}`;
      throw new Error('Unexpected credential-offer-uri response');
    } catch (error) {
      console.error('Error getting credential offer URI:', error);
      throw error;
    }
  }

  async fetchOffer(offerUrl: string): Promise<CredentialOffer> {
    const headers = await this.authHeaders();
    return await firstValueFrom(this.http.get<CredentialOffer>(offerUrl, { headers }));
  }

  // Build an openid-credential-offer deeplink (URI or JSON variant)
  buildOfferDeeplink(
    offer: CredentialOffer,
    offerUrl?: string,
    variant: 'uri' | 'json' = 'uri',
  ): string {
    try {
      if (variant === 'uri' && offerUrl) {
        const encoded = encodeURIComponent(offerUrl);
        const link = `openid-credential-offer://?credential_offer_uri=${encoded}`;
        return link;
      }
      // JSON variant - embed the offer as-is, but ensure issuer is absolute
      const normalized: CredentialOffer = { ...offer };
      if (!normalized.credential_issuer) {
        const issuer = `${runtimeEnvironment.keycloak.url}/realms/${runtimeEnvironment.keycloak.realm}`;
        normalized.credential_issuer = issuer;
      }
      const payload = JSON.stringify(normalized);
      const encoded = encodeURIComponent(payload);
      const link = `openid-credential-offer://?credential_offer=${encoded}`;
      return link;
    } catch (e) {
      console.error('[Oid4vcService] buildOfferDeeplink failed', e);
      throw e;
    }
  }

  // Convert a Blob to a data URL (usable as <img src>)
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Fetch a server-generated QR PNG for the credential offer (no client QR lib)
  async getCredentialOfferPng(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<Blob> {
    const token = await this.kc.getToken();
    const headers = new HttpHeaders({
      Accept: 'image/png',
      Authorization: `Bearer ${token}`,
    });
    const url = `${this.base()}/protocol/oid4vc/credential-offer-uri?credential_configuration_id=${encodeURIComponent(credentialConfigurationId)}&type=qr-code`;
    // Angular typing note: declare with generic type and cast responseType once
    const res = await firstValueFrom(
      this.http.get<Blob>(url, { headers, responseType: 'blob' as 'json' }),
    );
    // The response is already typed as Blob due to the generic parameter
    return res;
  }

  async getCredentialOfferQrDataUrl(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<string> {
    try {
      const pngBlob = await this.getCredentialOfferPng(credentialConfigurationId);
      const dataUrl = await this.blobToDataURL(pngBlob);
      return dataUrl;
    } catch (err) {
      console.error('[Oid4vcService] getCredentialOfferQrDataUrl failed (server PNG).', err);
      throw err;
    }
  }

  async getCredentialOfferDeeplink(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<string> {
    const offerUrl = await this.getCredentialOfferUri(credentialConfigurationId);
    const offer = await this.fetchOffer(offerUrl);
    const deeplink = this.buildOfferDeeplink(offer, offerUrl, 'uri');
    return deeplink;
  }
}
