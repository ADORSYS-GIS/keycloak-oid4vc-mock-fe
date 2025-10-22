import Keycloak from "keycloak-js";

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};

const keycloak = new Keycloak(keycloakConfig);

keycloak.onAuthSuccess = () => {
  console.log("Authentication successful");
};

keycloak.onAuthError = (error) => {
  console.error("Authentication failed:", error);
};

keycloak.onAuthRefreshError = () => {
  console.error("Token refresh failed");
};

export default keycloak;
