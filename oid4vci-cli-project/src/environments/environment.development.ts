export const environment = {
  production: false,
  keycloak: {
    url: 'https://localhost:8443',
    realm: 'master',
    clientId: 'my-angular-spa',
  },
  oid4vc: {
    defaultCredentialConfigurationId: 'KMACredential',
  },
};
