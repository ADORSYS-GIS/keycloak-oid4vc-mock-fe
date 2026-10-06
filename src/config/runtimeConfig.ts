export type RuntimeConfigKey =
  | 'VITE_KEYCLOAK_URL'
  | 'VITE_KEYCLOAK_REALM'
  | 'VITE_KEYCLOAK_CLIENT_ID'
  | 'VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID'
  | 'VITE_OID4VC_PRE_AUTHORIZED';

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<Record<RuntimeConfigKey, string>>;
  }
}

export function readConfig(key: RuntimeConfigKey): string {
  const runtime = window.__APP_CONFIG__?.[key];
  if (typeof runtime === 'string' && runtime.trim() !== '') {
    return runtime;
  }

  const builtIn = import.meta.env[key];
  return typeof builtIn === 'string' ? builtIn : '';
}
