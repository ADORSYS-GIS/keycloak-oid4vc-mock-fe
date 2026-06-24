import keycloak from '../config/keycloak.config';

interface CredentialOfferUriResponse {
  credential_offer_uri?: string;
  issuer?: string;
  nonce?: string;
  qr_code?: string;
}

interface CredentialOffer {
  credential_issuer?: string;
  [key: string]: unknown;
}

export const CredentialConfigurationId = {
  IDENTITY: 'IdentityCredential',
  DATEV_COMPANY: 'DatevCompanyCredential',
} as const;

export const DEFAULT_CREDENTIAL_CONFIGURATION_ID =
  import.meta.env.VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID ||
  CredentialConfigurationId.DATEV_COMPANY;

type QueryParams = Record<string, string | undefined>;

class Oid4vcService {
  private static readonly CREATE_CREDENTIAL_OFFER_ENDPOINT =
    '/protocol/oid4vc/create-credential-offer';

  private getIssuerBaseUrl(): string {
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    const realm = import.meta.env.VITE_KEYCLOAK_REALM;
    return `${keycloakUrl}/realms/${realm}`;
  }

  private getApiBaseUrl(): string {
    const apiBaseUrl = import.meta.env.VITE_OID4VC_API_BASE_URL || import.meta.env.VITE_KEYCLOAK_URL;
    const realm = import.meta.env.VITE_KEYCLOAK_REALM;
    return `${apiBaseUrl}/realms/${realm}`;
  }

  private getApiUrl(url: string): string {
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    const apiBaseUrl = import.meta.env.VITE_OID4VC_API_BASE_URL;

    if (!apiBaseUrl || !keycloakUrl || !url.startsWith(keycloakUrl)) return url;

    return `${apiBaseUrl}${url.slice(keycloakUrl.length)}`;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    // Ensure token is fresh
    await keycloak.updateToken(5);

    return {
      Authorization: `Bearer ${keycloak.token}`,
      Accept: 'application/json',
    };
  }

  private getUsername(): string {
    return keycloak.tokenParsed?.preferred_username || '';
  }

  private buildQueryString(params: QueryParams): string {
    return new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
  }

  async getCredentialOfferUri(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID
  ): Promise<string> {
    const data = await this.createCredentialOffer(credentialConfigurationId, 'uri');
    return this.getCredentialOfferUrl(data);
  }

  private async createCredentialOffer(
    credentialConfigurationId: string,
    responseType: 'uri' | 'uri_qr' | 'qr',
    dimensions?: { width: number; height: number }
  ): Promise<CredentialOfferUriResponse> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      pre_authorized: 'true',
      target_user: this.getUsername() || undefined,
      type: responseType,
      width: dimensions?.width.toString(),
      height: dimensions?.height.toString(),
    };

    const headers = await this.getAuthHeaders();
    const queryString = this.buildQueryString(queryParams);
    const url = `${this.getApiBaseUrl()}${Oid4vcService.CREATE_CREDENTIAL_OFFER_ENDPOINT}?${queryString}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(await this.getResponseError(response, 'Credential offer creation failed'));
    }

    return response.json();
  }

  private getCredentialOfferUrl(data: CredentialOfferUriResponse): string {
    if (data.credential_offer_uri) return data.credential_offer_uri;

    if (data.issuer && data.nonce) {
      return `${data.issuer.replace(/\/$/, '')}/${data.nonce}`;
    }

    throw new Error('Credential offer response did not include issuer/nonce or credential_offer_uri');
  }

  private async getResponseError(response: Response, fallback: string): Promise<string> {
    try {
      const body = await response.text();
      return body
        ? `${fallback}: ${response.status} ${response.statusText} - ${body}`
        : `${fallback}: ${response.status} ${response.statusText}`;
    } catch {
      return `${fallback}: ${response.status} ${response.statusText}`;
    }
  }

  async fetchOffer(offerUrl: string): Promise<CredentialOffer> {
    const response = await fetch(this.getApiUrl(offerUrl), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch offer: ${response.statusText}`);
    }

    return response.json();
  }

  buildOfferDeeplink(
    offer: CredentialOffer,
    offerUrl?: string,
    variant: 'uri' | 'json' = 'uri'
  ): string {
    try {
      if (variant === 'uri' && offerUrl) {
        const encoded = encodeURIComponent(offerUrl);
        return `openid-credential-offer://?credential_offer_uri=${encoded}`;
      }

      // JSON variant
      const normalized: CredentialOffer = { ...offer };

      if (!normalized.credential_issuer) {
        normalized.credential_issuer = this.getIssuerBaseUrl();
      }

      const payload = JSON.stringify(normalized);
      const encoded = encodeURIComponent(payload);

      return `openid-credential-offer://?credential_offer=${encoded}`;
    } catch (error) {
      console.error('Error building offer deeplink:', error);
      throw error;
    }
  }

  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getCredentialOfferPng(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID
  ): Promise<Blob> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      pre_authorized: 'true',
      target_user: this.getUsername() || undefined,
      type: 'qr',
      width: '360',
      height: '360',
    };

    const baseHeaders = await this.getAuthHeaders();
    const queryString = this.buildQueryString(queryParams);
    const url = `${this.getApiBaseUrl()}${Oid4vcService.CREATE_CREDENTIAL_OFFER_ENDPOINT}?${queryString}`;

    const response = await fetch(url, {
      headers: {
        ...baseHeaders,
        Accept: 'image/png',
      },
    });

    if (!response.ok) {
      throw new Error(await this.getResponseError(response, 'Credential offer QR creation failed'));
    }

    return response.blob();
  }

  async getCredentialOfferQrDataUrl(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID
  ): Promise<string> {
    try {
      const pngBlob = await this.getCredentialOfferPng(credentialConfigurationId);
      return this.blobToDataURL(pngBlob);
    } catch (error) {
      const offer = await this.createCredentialOffer(credentialConfigurationId, 'uri_qr', {
        width: 360,
        height: 360,
      });

      if (offer.qr_code) {
        return offer.qr_code;
      }

      console.error('Failed to get QR code data URL:', error);
      throw error;
    }
  }

  async getCredentialOfferDeeplink(
    byReference: boolean = true,
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID
  ): Promise<string> {
    const offerUrl = await this.getCredentialOfferUri(credentialConfigurationId);

    if (byReference) {
      return this.buildOfferDeeplink({}, offerUrl, 'uri');
    }

    const offer = await this.fetchOffer(offerUrl);
    return this.buildOfferDeeplink(offer, offerUrl, 'json');
  }
}

export default new Oid4vcService();
