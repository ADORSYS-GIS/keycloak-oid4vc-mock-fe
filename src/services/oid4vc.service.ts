import keycloak from '../config/keycloak.config';
import type { UserProfile } from '../types';

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
  /**
   * Convenience flag: true only when plugin status is INVALID.
   * Do not use this alone for UI badges — UNKNOWN/SUSPENDED also map to revoked:false
   * but must not look Valid. Prefer `serverStatus` (or the dashboard `status` field).
   */
  revoked?: boolean;
  /**
   * Authoritative plugin status when this row came from
   * `/status-list/issued-credential-status` (`VALID` / `INVALID` / `SUSPENDED` / `UNKNOWN`).
   * The dashboard maps this to the badge and only enables Revoke for VALID.
   */
  serverStatus?: string;
}

interface IssuedCredentialStatusResponse {
  credentials: IssuedCredentialStatusEntry[];
}

export interface IssuedCredentialStatusEntry {
  credentialId: string;
  verifiableCredentialId?: string;
  /** Credential configuration/type (client-scope name), same value as the account endpoint. */
  credentialType?: string;
  issuedAt?: number;
  expiresAt?: number | null;
  clientId?: string;
  /** Display name of the requesting client, falling back to its public client id. */
  clientName?: string;
  revision?: string;
  status: string;
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
  String(import.meta.env.VITE_OID4VC_PRE_AUTHORIZED)
    .trim()
    .toLowerCase() === 'true';

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
    ISSUED_CREDENTIAL_STATUS: '/status-list/issued-credential-status',
    TOKEN_REVOCATION: '/status-list/revoke',
  };

  private getBaseUrl(): string {
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    const realm = import.meta.env.VITE_KEYCLOAK_REALM;
    return `${keycloakUrl}/realms/${realm}`;
  }

  private getAdminBaseUrl(): string {
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    const realm = import.meta.env.VITE_KEYCLOAK_REALM;
    return `${keycloakUrl}/admin/realms/${realm}`;
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
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
    targetUser: string = this.getUsername()
  ): Promise<string> {
    return this.withFallback(
      () => this.getCredentialOfferUriKeycloak26_6_0(credentialConfigurationId, targetUser),
      () => this.getCredentialOfferUriPreKeycloak26_6_0(credentialConfigurationId, targetUser),
      'CredentialOfferUri'
    );
  }

  private async getCredentialOfferUriKeycloak26_6_0(
    credentialConfigurationId: string,
    targetUser: string
  ): Promise<string> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      target_user: targetUser,
      pre_authorized: IS_PRE_AUTHORIZED_FLOW ? 'true' : 'false',
    };

    return this.fetchCredentialOfferUri(
      Oid4vcService.ENDPOINTS.CREATE_CREDENTIAL_OFFER,
      queryParams,
      EndpointType.KEYCLOAK_26_6_0
    );
  }

  private async getCredentialOfferUriPreKeycloak26_6_0(
    credentialConfigurationId: string,
    targetUser: string
  ): Promise<string> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      username: targetUser,
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
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
    targetUser: string = this.getUsername()
  ): Promise<Blob> {
    return this.withFallback(
      () => this.getCredentialOfferPngKeycloak26_6_0(credentialConfigurationId, targetUser),
      () => this.getCredentialOfferPngPreKeycloak26_6_0(credentialConfigurationId, targetUser),
      'CredentialOfferPng'
    );
  }

  private async getCredentialOfferPngKeycloak26_6_0(
    credentialConfigurationId: string,
    targetUser: string
  ): Promise<Blob> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      target_user: targetUser,
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
    credentialConfigurationId: string,
    targetUser: string
  ): Promise<Blob> {
    const queryParams: QueryParams = {
      credential_configuration_id: credentialConfigurationId,
      username: targetUser,
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
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
    targetUser: string = this.getUsername()
  ): Promise<string> {
    try {
      const pngBlob = await this.getCredentialOfferPng(credentialConfigurationId, targetUser);
      return this.blobToDataURL(pngBlob);
    } catch (error) {
      console.error('Failed to get QR code data URL:', error);
      throw error;
    }
  }

  async getCredentialOfferDeeplink(
    byReference: boolean = true,
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
    targetUser: string = this.getUsername()
  ): Promise<string> {
    const offerUrl = await this.getCredentialOfferUri(credentialConfigurationId, targetUser);

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

  /**
   * Fetches issued-credential statuses from `/status-list/issued-credential-status`.
   * - No argument: statuses for the authenticated bearer (self-service merge with account metadata).
   * - With `targetUser`: statuses for that holder (admin list).
   */
  async getIssuedCredentialStatus(targetUser?: string): Promise<IssuedCredentialStatusEntry[]> {
    const queryString = this.buildQueryString({ target_user: targetUser });
    const suffix = queryString ? `?${queryString}` : '';
    const response = await this.getJsonResponse<IssuedCredentialStatusResponse>(
      `${this.getBaseUrl()}${Oid4vcService.ENDPOINTS.ISSUED_CREDENTIAL_STATUS}${suffix}`,
      'Issued credential status lookup'
    );

    return response.credentials;
  }

  /**
   * Admin credential list for another user.
   * Calls the same plugin endpoint as {@link getIssuedCredentialStatus}, then maps each
   * entry onto the dashboard credential shape.
   *
   * Important: the plugin `status` is kept as `serverStatus`. Collapsing it to a boolean
   * `revoked` would make UNKNOWN and SUSPENDED look Valid in the UI, and revoke would
   * then 404 when no status-list mapping exists.
   */
  async getIssuedCredentialsFor(targetUser: string): Promise<IssuedVerifiableCredential[]> {
    const entries = await this.getIssuedCredentialStatus(targetUser);

    return entries.map((credential) => ({
      id: credential.credentialId,
      credentialType: credential.credentialType,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt ?? undefined,
      clientId: credential.clientId,
      clientName: credential.clientName,
      revision: credential.revision,
      serverStatus: credential.status,
      revoked: credential.status === 'INVALID',
    }));
  }

  /**
   * Lists every realm user (admin flow) via the Keycloak Admin REST API.
   *
   * Permission model: `credential-offer-create` is enough to *act* on another user
   * (offer / list / revoke), but it is **not** enough to enumerate realm users.
   * The caller must also hold a realm-management role that grants user visibility
   * (`view-users` or `query-users`). A token with only `credential-offer-create`
   * receives 403 from `/users/count` and this method rejects; the dashboard then
   * disables the target dropdown rather than inventing a user list.
   *
   * The count endpoint sizes the list request so every realm user is returned —
   * Keycloak would otherwise silently cap the response at its default of 100 entries.
   */
  async getRealmUsers(): Promise<UserProfile[]> {
    const count = await this.getJsonResponse<number>(
      `${this.getAdminBaseUrl()}/users/count`,
      'Realm users count'
    );

    if (count <= 0) return [];

    return this.getJsonResponse<UserProfile[]>(
      `${this.getAdminBaseUrl()}/users?briefRepresentation=true&max=${count}`,
      'Realm users lookup'
    );
  }

  async revokeIssuedCredential(
    credentialId: string,
    reason = 'Client app revocation'
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    // Backend (token-status-link) authorizes admin revoke from the bearer role + credential_id.
    // It does not read target_user. Sending that field would only mislead docs/tests into
    // thinking the client scopes the revoke — so the body matches self-service revoke.
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
