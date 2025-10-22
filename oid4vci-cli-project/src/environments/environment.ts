// Prod
export const environment = {
  production: true,
  keycloak: {
    url: 'https://oid4vc-idp.apps.dev.datev.de',
    realm: 'oid4vc-vci',
    clientId: 'oid4vc-demo-public',
  },
  oid4vc: {
    defaultCredentialConfigurationId: 'KMACredential',
  },
};
