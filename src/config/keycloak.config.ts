import Keycloak from 'keycloak-js';
import { readConfig } from './runtimeConfig';

const keycloakConfig = {
  url: readConfig('VITE_KEYCLOAK_URL'),
  realm: readConfig('VITE_KEYCLOAK_REALM'),
  clientId: readConfig('VITE_KEYCLOAK_CLIENT_ID'),
};

const keycloak = new Keycloak(keycloakConfig);

keycloak.onAuthSuccess = () => {
  console.log('Authentication successful');
};

keycloak.onAuthError = (error) => {
  console.error('Authentication failed:', error);
};

keycloak.onAuthRefreshError = () => {
  console.error('Token refresh failed');
};

export default keycloak;
