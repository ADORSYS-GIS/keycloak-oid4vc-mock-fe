import keycloak from "../config/keycloak.config";

interface CredentialOfferUriResponse {
  credential_offer_uri?: string;
  issuer?: string;
  nonce?: string;
}

interface CredentialOffer {
  credential_issuer?: string;
  [key: string]: unknown;
}

export const CredentialConfigurationId = {
  KMA: "KMACredential",
} as const;

export const DEFAULT_CREDENTIAL_CONFIGURATION_ID =
  import.meta.env.VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID ||
  CredentialConfigurationId.KMA;

class Oid4vcService {
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
      Accept: "application/json",
    };
  }

  async getCredentialOfferUri(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<string> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${this.getBaseUrl()}/protocol/oid4vc/credential-offer-uri?`
      + `credential_configuration_id=${encodeURIComponent(credentialConfigurationId)}`
      +`&username=${encodeURIComponent(keycloak.tokenParsed?.preferred_username || "")}`;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(
          `Failed to get credential offer URI: ${response.statusText}`,
        );
      }

      const data: string | CredentialOfferUriResponse = await response.json();

      if (typeof data === "string") return data;
      if (data?.credential_offer_uri) return data.credential_offer_uri;
      if (data?.issuer && data?.nonce) return `${data.issuer}${data.nonce}`;

      throw new Error("Unexpected credential-offer-uri response");
    } catch (error) {
      console.error("Error getting credential offer URI:", error);
      throw error;
    }
  }

  async fetchOffer(offerUrl: string): Promise<CredentialOffer> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(offerUrl, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch offer: ${response.statusText}`);
    }

    return response.json();
  }

  buildOfferDeeplink(
    offer: CredentialOffer,
    offerUrl?: string,
    variant: "uri" | "json" = "uri",
  ): string {
    try {
      if (variant === "uri" && offerUrl) {
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
      console.error("Error building offer deeplink:", error);
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
  ): Promise<Blob> {
    await keycloak.updateToken(5);

    const headers = {
      Accept: "image/png",
      Authorization: `Bearer ${keycloak.token}`,
    };

    const url = `${this.getBaseUrl()}/protocol/oid4vc/credential-offer-uri?credential_configuration_id=${encodeURIComponent(credentialConfigurationId)}&type=qr-code`
    +`&username=${encodeURIComponent(keycloak.tokenParsed?.preferred_username || "")}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to get QR code: ${response.statusText}`);
    }

    return response.blob();
  }

  async getCredentialOfferQrDataUrl(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<string> {
    try {
      const pngBlob = await this.getCredentialOfferPng(
        credentialConfigurationId,
      );
      const dataUrl = await this.blobToDataURL(pngBlob);
      return dataUrl;
    } catch (error) {
      console.error("Failed to get QR code data URL:", error);
      throw error;
    }
  }

  async getCredentialOfferDeeplink(
    credentialConfigurationId: string = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
  ): Promise<string> {
    const offerUrl = await this.getCredentialOfferUri(
      credentialConfigurationId,
    );
    const offer = await this.fetchOffer(offerUrl);
    const deeplink = this.buildOfferDeeplink(offer, offerUrl, "uri");
    return deeplink;
  }
}

export default new Oid4vcService();
