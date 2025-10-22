#!/usr/bin/env sh
set -e

# Ensure assets directory exists at runtime
mkdir -p /usr/share/nginx/html/assets

# Generate runtime env file consumed by index.html before Angular bootstraps
node -e "
const env = {
  KEYCLOAK_URL: process.env.KEYCLOAK_URL || '',
  KEYCLOAK_REALM: process.env.KEYCLOAK_REALM || '',
  KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID || '',
  OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID: process.env.OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID || '',
  PRODUCTION: process.env.PRODUCTION === 'true' ? 'true' : ''
};

const js = \`(function () {
  window.__env = window.__env || {};
\${Object.entries(env).filter(([k, v]) => v !== '').map(([k, v]) => \`  window.__env.\${k} = \${JSON.stringify(v)};\`).join('\n')}
})();
\`;

require('fs').writeFileSync('/usr/share/nginx/html/assets/env.js', js);
"

exec "$@"


