# Issues Resolved

## Local OID4VCI Troubleshooting Notes

This section tracks the issues we hit while wiring the mock frontend to the recent Keycloak OID4VCI implementation.

### 1. Browser login failed against local HTTPS Keycloak

**Symptom**

The browser console showed token requests failing against Keycloak, for example:

```text
POST https://localhost:8443/realms/oid4vc-vci/protocol/openid-connect/token net::ERR_FAILED
Failed to initialize Keycloak: TypeError: Failed to fetch
```

**Cause**

Local Keycloak was running on HTTPS with a self-signed certificate. Chrome blocks browser fetch/XHR calls to that origin unless the certificate is trusted or Chrome is started in a local insecure mode.

**Resolution used for local testing**

Start Chrome with a separate temporary profile and allow insecure localhost certificates:

```bash
google-chrome \
  --user-data-dir=/tmp/chrome-keycloak-insecure \
  --ignore-certificate-errors \
  --allow-insecure-localhost \
  http://localhost:4200/
```

For a less temporary fix, import/trust the local Keycloak certificate in the OS/browser trust store.

### 2. Credential offer QR could not be generated

**Symptom**

After login succeeded, the dashboard failed while retrieving the credential offer.

**Cause**

The frontend was still compatible with an older Keycloak OID4VCI offer API. Recent Keycloak exposes the REST credential-offer endpoint at:

```text
/realms/{realm}/protocol/oid4vc/create-credential-offer
```

The response for `type=uri` is not always a plain string. It can return JSON like:

```json
{
  "issuer": "https://localhost:8443/realms/oid4vc-vci/protocol/oid4vc/credential-offer",
  "nonce": "..."
}
```

**Resolution**

`src/services/oid4vc.service.ts` now uses the current `create-credential-offer` endpoint and builds the offer URI from `issuer` + `nonce` when `credential_offer_uri` is not returned. It also supports both wallet deeplink variants:

- By reference: `openid-credential-offer://?credential_offer_uri=...`
- By value: `openid-credential-offer://?credential_offer=...`

The dashboard displays both QR codes so wallets can be tested with either format.

### 3. Keycloak rejected offer creation for `francis`

**Symptom**

Keycloak returned:

```json
{
  "error": "invalid_credential_offer_request",
  "error_description": "User 'francis' does not have verifiable credential 'IdentityCredential'."
}
```

**Cause**

Recent Keycloak checks whether the target user has the requested verifiable credential assigned. The user `francis` existed, and the `IdentityCredential` client scope existed, but the user did not have that VC grant.

**Resolution**

Grant `IdentityCredential` to `francis` through the Keycloak admin API:

```bash
TOKEN=$(curl -k -s -X POST https://localhost:8443/realms/master/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode grant_type=password \
  --data-urlencode client_id=admin-cli \
  --data-urlencode username=admin \
  --data-urlencode password=admin | jq -r .access_token)

USER_ID=$(curl -k -s \
  -H "Authorization: Bearer $TOKEN" \
  'https://localhost:8443/admin/realms/oid4vc-vci/users?username=francis&exact=true' | jq -r '.[0].id')

curl -k -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"credentialScopeName":"IdentityCredential"}' \
  "https://localhost:8443/admin/realms/oid4vc-vci/users/$USER_ID/vc/credentials"
```

This has also been moved into Terraform in the Keycloak infrastructure repo so future environments get the grant automatically.

### 4. Keycloak startup features for recent OID4VCI

For the recent Keycloak code used here, start Keycloak with the OID4VCI feature flags required by the REST credential-offer flow:

```text
--features=oid4vc-vci,oid4vc-vci-preauth-code,oid4vc-vci-rest-credential-offer
```

The Helm demo values in the infrastructure repo were updated accordingly.

### 5. Current known-good local frontend environment

```env
VITE_KEYCLOAK_URL=https://localhost:8443
VITE_KEYCLOAK_REALM=oid4vc-vci
VITE_KEYCLOAK_CLIENT_ID=oid4vc-demo-public
VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID=IdentityCredential
VITE_APP_BASE_URL=http://localhost:4200/
```

The Keycloak client `oid4vc-demo-public` must include matching redirect URIs and web origins for the browser URL used by the frontend, including `localhost` or `127.0.0.1`, and `http` or `https` as needed.

### 6. Ngrok offer request looked like CORS even though Keycloak returned CORS

**Symptom**

The browser console showed the offer endpoint failing with CORS even though the network status was `200 OK`:

```text
Access to fetch at 'https://...ngrok-free.app/realms/oid4vc-vci/protocol/oid4vc/create-credential-offer?...' from origin 'http://localhost:4200' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
oid4vc.service.ts:80 GET ... net::ERR_FAILED 200 (OK)
```

**Cause**

The Keycloak/ngrok endpoint was returning the correct CORS headers when tested directly, but Chrome was still controlled by an old `service-worker.js` registered for `localhost:4200`. That stale worker could intercept requests and make the browser report a misleading CORS error.

Do not add `ngrok-skip-browser-warning` from frontend `fetch` calls as a fix. That custom header triggers a browser preflight, and Keycloak does not allow that header in `Access-Control-Allow-Headers`.

**Resolution**

The app clears stale service workers and browser caches in dev mode from `src/main.tsx`. The OID4VC service also supports `VITE_OID4VC_API_BASE_URL=/__keycloak`, which routes credential-offer API calls through the Vite dev proxy and avoids browser CORS entirely while keeping `VITE_KEYCLOAK_URL` public for login and wallet-facing issuer URLs. If the error persists, manually clear Chrome state for `localhost:4200`:

```js
navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
```

Then hard reload the page. Using a fresh port, such as `localhost:4201`, also bypasses service workers scoped to `localhost:4200`.


When the proxy is active, browser network requests for offer creation should go to:

```text
http://localhost:4200/__keycloak/realms/oid4vc-vci/protocol/oid4vc/create-credential-offer?...
```

The returned offer should still contain the ngrok issuer URL so the online wallet can resolve it.

### 7. Wallet scans QR but credential issuance fails

**Symptom**

The online wallet can scan the QR code and reach Keycloak, but credential issuance fails. Keycloak logs show:

```text
VERIFIABLE_CREDENTIAL_REQUEST_ERROR ... error="invalid_credential_request", reason="Credential must be requested by credential identifier from authorization_details: [IdentityCredential]", username="francis"
VERIFIABLE_CREDENTIAL_REQUEST_ERROR ... error="invalid_credential_request", reason="No credential_configuration_id nor credential_identifier in credential request: {}", username="francis"
```

**Cause**

At this point the frontend offer generation is working. The offer contains:

```json
{
  "credential_configuration_ids": ["IdentityCredential"]
}
```

Recent Keycloak includes credential identifiers in the token response `authorization_details`. After the wallet exchanges the pre-authorized code for an access token, it must read the credential identifier from the token response, for example:

```json
{
  "authorization_details": [
    {
      "type": "openid_credential",
      "credential_configuration_id": "IdentityCredential",
      "credential_identifiers": ["IdentityCredential"]
    }
  ]
}
```

The wallet must then request the credential by `credential_identifier`, not by `credential_configuration_id`.

**Required wallet request**

The credential endpoint request body should contain:

```json
{
  "credential_identifier": "IdentityCredential",
  "proof": {
    "...": "..."
  }
}
```

The failing wallet appears to send either:

```json
{
  "credential_configuration_id": "IdentityCredential"
}
```

or an empty request body:

```json
{}
```

Recent Keycloak rejects both of those when `credential_identifiers` were returned in `authorization_details`.

**Resolution**

This is a wallet compatibility issue, not a frontend or Terraform issue. Use a wallet that supports the recent OID4VCI `credential_identifier` flow, or update the wallet implementation so it:

1. Exchanges the pre-authorized code for a token.
2. Reads `authorization_details[0].credential_identifiers[0]` from the token response.
3. Sends that value as `credential_identifier` in the credential request body.

The Keycloak warning below is not the blocking error:

```text
No valid encryption keys found; omitting credential_request_encryption metadata.
```

It only means Keycloak does not advertise encrypted credential requests. The blocker is the wallet credential request body.
