import { environment } from '../../environments/environment';

export interface RuntimeEnvironment {
  production: boolean;
  keycloak: {
    url: string;
    realm: string;
    clientId: string;
  };
  oid4vc: {
    defaultCredentialConfigurationId: string;
  };
}

declare global {
  interface Window {
    __env?: Partial<RuntimeEnvironment> & {
      KEYCLOAK_URL?: string;
      KEYCLOAK_REALM?: string;
      KEYCLOAK_CLIENT_ID?: string;
      OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID?: string;
      PRODUCTION?: string | boolean;
    };
  }
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return fallback;
}

export const runtimeEnvironment: RuntimeEnvironment = (() => {
  const win = typeof window !== 'undefined' ? window : ({} as Window);
  const overrides = win.__env || {};

  // Support both nested object overrides and flat VAR-style overrides
  const flatKeycloak = {
    url: overrides.KEYCLOAK_URL,
    realm: overrides.KEYCLOAK_REALM,
    clientId: overrides.KEYCLOAK_CLIENT_ID,
  } as Partial<RuntimeEnvironment['keycloak']>;

  const merged: RuntimeEnvironment = {
    production: toBoolean(overrides.PRODUCTION, environment.production),
    keycloak: {
      url:
        flatKeycloak.url ??
        (overrides.keycloak?.url as string | undefined) ??
        environment.keycloak.url,
      realm:
        flatKeycloak.realm ??
        (overrides.keycloak?.realm as string | undefined) ??
        environment.keycloak.realm,
      clientId:
        flatKeycloak.clientId ??
        (overrides.keycloak?.clientId as string | undefined) ??
        environment.keycloak.clientId,
    },
    oid4vc: {
      defaultCredentialConfigurationId:
        (overrides.OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID as string | undefined) ??
        (overrides.oid4vc?.defaultCredentialConfigurationId as string | undefined) ??
        environment.oid4vc?.defaultCredentialConfigurationId ??
        'KMACredential',
    },
  };

  return merged;
})();
