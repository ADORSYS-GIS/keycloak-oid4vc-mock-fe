import keycloak from '../config/keycloak.config';

interface CredentialOfferUriResponse {
  credential_offer_uri?: string;
  issuer?: string;
  nonce?: string;
}

interface CredentialOffer {
  credential_issuer?: string;
  [key: string]: unknown;
}

export interface IssuedVerifiableCredential {
  id: string;
  userId?: string;
  credentialType?: string;
  issuedAt?: number;
  expiresAt?: number;
  clientId?: string;
  clientName?: string;
  clientBaseUrl?: string;
  revision?: string;
}

interface CredentialRevocationResponse {
  success?: boolean;
  message?: string;
  error?: string;
  error_description?: string;
}

export const CredentialConfigurationId = {
  DATEV_COMPANY: 'DatevCompanyCredential',
} as const;

export const DEFAULT_CREDENTIAL_CONFIGURATION_ID =
  import.meta.env.VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID ||
  CredentialConfigurationId.DATEV_COMPANY;

export const IS_PRE_AUTHORIZED_FLOW =
  String(import.meta.env.VITE_OID4VC_PRE_AUTHORIZED).trim().toLowerCase() === 'true';

const EndpointType = {
  KEYCLOAK_26_6_0: 'keycloak_26_6_0',
  PRE_KEYCLOAK_26_6_0: 'pre_keycloak_26_6_0',
} as const;

type EndpointType = (typeof EndpointType)[keyof typeof EndpointType];

type QueryParams = Record<string, string | undefined>;

class Oid4vcService {
  private static readonly ENDPOINTS = {
    CREATE_CREDENTIAL_OFFER: '/protocol/oid4vc/create-credential-offer',
    CREDENTIAL_OFFER_URI: '/protocol/oid4vc/credential-offer-uri',
    ISSUED_VERIFIABLE_CREDENTIALS: '/account/issued-verifiable-credentials',
    TOKEN_REVOCATION: '/protocol/openid-connect/revoke',
  };

  private getBaseUrl(): string {
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    const realm = import.meta.env.VITE_KEYCLOAK_REALM;
    return `${keycloakUrl}/realms/${realm}`;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    // Ensure token is fresh
    await keycloak.updateToken(5);

    return {
      Authorization: `Bearer ${keycloak.token}`,
      Accept: 'application/json',
    };
  }

  private async getJsonResponse<T>(url: string, context: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`${context} failed: ${await this.getResponseError(response)}`);
    }

    return response.json();
  }

  private async getResponseError(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as CredentialRevocationResponse;
      return data.error_description || data.message || data.error || response.statusText;
    } catch {
      return response.statusText;
    }
  }

  private getUsername(): string {
    return keycloak.tokenParsed?.preferred_username || '';
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private buildQueryString(params: QueryParams): string {
    return new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
  }

  private async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await primary();
    } catch (primaryError) {
      console.warn(`${context} primary failed, falling back`, primaryError);

      try {
        return await fallback();
      } catch (fallbackError) {
        console.error(`${context} both strategies failed`, {
          primaryError: this.getErrorMessage(primaryError),
          fallbackError: this.getErrorMessage(fallbackError),
        });

        throw new Error(
          `${context} failed. Primary: ${this.getErrorMessage(primaryError)}, Fallback: ${this.getErrorMessage(fallbackError)}`
        );
      }
    }
  }

  async getCredentialOfferUri(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID
  ): Promise<string> {
    return this.withFallback(
      () => this.getCredentialOfferUriKeycloak26_6_0(credentialConfigurationId),
      () => this.getCredentialOfferUriPreKeycloak26_6_0(credentialConfigurationId),
      'CredentialOfferUri'
    );
  }

  private async getCredentialOfferUriKeycloak26_6_0(
    credentialConfigurationId: string
  ): Promise<string> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      target_user: this.getUsername(),
      pre_authorized: IS_PRE_AUTHORIZED_FLOW ? 'true' : 'false',
    };

    return this.fetchCredentialOfferUri(
      Oid4vcService.ENDPOINTS.CREATE_CREDENTIAL_OFFER,
      queryParams,
      EndpointType.KEYCLOAK_26_6_0
    );
  }

  private async getCredentialOfferUriPreKeycloak26_6_0(
    credentialConfigurationId: string
  ): Promise<string> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      username: this.getUsername(),
    };

    return this.fetchCredentialOfferUri(
      Oid4vcService.ENDPOINTS.CREDENTIAL_OFFER_URI,
      queryParams,
      EndpointType.PRE_KEYCLOAK_26_6_0
    );
  }

  private async fetchCredentialOfferUri(
    endpointPath: string,
    queryParams: QueryParams,
    endpointType: EndpointType
  ): Promise<string> {
    const headers = await this.getAuthHeaders();
    const queryString = this.buildQueryString(queryParams);
    const url = `${this.getBaseUrl()}${endpointPath}?${queryString}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`${endpointType} endpoint failed: ${response.statusText}`);
    }

    const data: string | CredentialOfferUriResponse = await response.json();

    if (typeof data === 'string') return data;
    if (data?.credential_offer_uri) return data.credential_offer_uri;

    if (data?.issuer && data?.nonce) {
      const base = data.issuer.replace(/\/$/, '');
      return `${base}/${data.nonce}`;
    }

    throw new Error(`Unexpected response from ${endpointType} endpoint`);
  }

  async fetchOffer(offerUrl: string): Promise<CredentialOffer> {
    const response = await fetch(offerUrl, {
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
        normalized.credential_issuer = this.getBaseUrl();
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
    return this.withFallback(
      () => this.getCredentialOfferPngKeycloak26_6_0(credentialConfigurationId),
      () => this.getCredentialOfferPngPreKeycloak26_6_0(credentialConfigurationId),
      'CredentialOfferPng'
    );
  }

  private async getCredentialOfferPngKeycloak26_6_0(
    credentialConfigurationId: string
  ): Promise<Blob> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      target_user: this.getUsername(),
      pre_authorized: IS_PRE_AUTHORIZED_FLOW ? 'true' : 'false',
      type: 'qr-code',
    };

    return this.fetchCredentialOfferPng(
      Oid4vcService.ENDPOINTS.CREATE_CREDENTIAL_OFFER,
      queryParams,
      EndpointType.KEYCLOAK_26_6_0
    );
  }

  private async getCredentialOfferPngPreKeycloak26_6_0(
    credentialConfigurationId: string
  ): Promise<Blob> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      username: this.getUsername(),
      type: 'qr-code',
    };

    return this.fetchCredentialOfferPng(
      Oid4vcService.ENDPOINTS.CREDENTIAL_OFFER_URI,
      queryParams,
      EndpointType.PRE_KEYCLOAK_26_6_0
    );
  }

  private async fetchCredentialOfferPng(
    endpointPath: string,
    queryParams: QueryParams,
    endpointType: EndpointType
  ): Promise<Blob> {
    const baseHeaders = await this.getAuthHeaders();

    const headers = {
      ...baseHeaders,
      Accept: 'image/png',
    };

    const queryString = this.buildQueryString(queryParams);
    const url = `${this.getBaseUrl()}${endpointPath}?${queryString}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`${endpointType} QR endpoint failed: ${response.statusText}`);
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

  async getIssuedCredentials(): Promise<IssuedVerifiableCredential[]> {
    return this.getJsonResponse<IssuedVerifiableCredential[]>(
      `${this.getBaseUrl()}${Oid4vcService.ENDPOINTS.ISSUED_VERIFIABLE_CREDENTIALS}`,
      'Issued credentials lookup'
    );
  }

  async revokeIssuedCredential(
    credentialId: string,
    reason = 'Client app revocation'
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    const body = new URLSearchParams({
      mode: 'issued_credential_revocation',
      credential_id: credentialId,
      reason,
    });

    const response = await fetch(
      `${this.getBaseUrl()}${Oid4vcService.ENDPOINTS.TOKEN_REVOCATION}`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Issued credential revocation failed: ${await this.getResponseError(response)}`
      );
    }
  }
}

export default new Oid4vcService();
