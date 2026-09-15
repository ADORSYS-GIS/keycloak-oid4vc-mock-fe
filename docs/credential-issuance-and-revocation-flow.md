# Credential Issuance and Revocation Flow

This document describes how the mock frontend participates in credential issuance, issued credential listing, and issued credential revocation.

The key change in this flow is that revocation is initiated from the client application against Keycloak's issued credential revocation endpoint. The wallet no longer owns the revocation action.

## UI Flow

The dashboard has two top-level tabs:

- `Credential Offer`: displays a single QR code at a time. `By reference` is the default view and appears before `By value`.
- `Credentials`: lists issued credentials for the authenticated user and exposes the `Revoke` action.

The credential offer QR code can be toggled between:

- `By reference`: encodes `openid-credential-offer://?credential_offer_uri=...`
- `By value`: encodes `openid-credential-offer://?credential_offer=...`

Only one QR code is rendered at a time so the page stays compact and the user does not need to scroll between two QR cards.

## Client Responsibilities

The frontend is responsible for:

- authenticating the user through Keycloak;
- requesting credential offer links from Keycloak;
- rendering the selected QR code variant;
- loading issued credentials for the authenticated account;
- loading the issuance quota (`limits`) for the account and warning when the cap is reached;
- collecting a revocation reason before sending the revocation request;
- keeping a revoked credential visible in the UI with status `revoked`.

The frontend is not responsible for:

- deciding whether the user owns the credential;
- directly updating the status list server;
- directly talking to the wallet during revocation;
- validating credential status during presentation.

Those checks and state changes belong to Keycloak, the OID4VC plugins, the wallet, and the status list server.

## API Calls Used By The Client

### Create Credential Offer

The client first tries the Keycloak 26.6+ endpoint:

```text
GET /realms/{realm}/protocol/oid4vc/create-credential-offer
```

Query parameters:

```text
credential_configuration_id={credentialType}
target_user={preferred_username}
pre_authorized=true
```

If that fails, the client falls back to the older endpoint:

```text
GET /realms/{realm}/protocol/oid4vc/credential-offer-uri
```

Query parameters:

```text
credential_configuration_id={credentialType}
username={preferred_username}
```

### Load Issued Credentials

```text
GET /realms/{realm}/account/issued-verifiable-credentials
```

The response is displayed in the `Credentials` tab. The UI uses the credential `id` as the revocation target and displays:

- credential type;
- issued timestamp;
- revision;
- wallet client;
- status.

### Load Issuance Limits

```text
GET /realms/{realm}/protocol/openid-connect/issued-credential-status
Accept: application/json
```

Bearer-authenticated like the other realm endpoints. Only the optional `limits` array is used by the client:

```json
{
  "credentials": [],
  "limits": [
    {
      "credentialConfigurationId": "IdentityCredential",
      "max": 3,
      "activeCount": 3,
      "remaining": 0,
      "overflowPolicy": "REJECT"
    }
  ]
}
```

Credential types without a configured maximum are omitted from `limits`.

### Revoke Issued Credential

```text
POST /realms/{realm}/status-list/revoke
Content-Type: application/x-www-form-urlencoded
```

Form body:

```text
mode=issued_credential_revocation
credential_id={issuedCredentialId}
reason={userProvidedReason}
```

After a successful response, the frontend marks the credential as `revoked` locally and keeps it visible. This is intentional: a revoked credential should remain auditable in the UI instead of disappearing from the list.

## Sequence Diagram

![Credential issuance and revocation sequence diagram](assets/revocation.png)

## Revocation Behavior

Revocation is scoped to issued credentials, not to credential offers. A single available credential can produce multiple issued credentials across wallets. Revoking one issued credential should update the status list entry for that issued credential only.

The revocation action must remain server-authoritative:

- Keycloak must verify that the authenticated user is allowed to revoke the issued credential.
- Keycloak must find the status list mapping for the issued credential.
- Keycloak must update the status list server.
- The frontend only reflects the successful server response.

## Issuance Limit Warning

The token-status-list plugin can cap how many non-revoked credentials a holder may hold per credential type (mapper config `status-list-max-credentials-per-user`, configured in the Keycloak Admin Console).

The client is not responsible for configuring or enforcing the limit. It only warns:

- On mount, the dashboard loads issued-credential status from `GET .../protocol/openid-connect/issued-credential-status` and reads the optional `limits` array.
- On the `Credential Offer` tab, when the entry for `VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID` has `remaining: 0`, an advisory warning is shown above the QR code.
- The QR code stays visible and scannable; the warning is advisory. The plugin still rejects actual issuance.
- After a successful revocation, the client reloads `limits` so the warning clears.
- If the `limits` payload is missing, empty, or the endpoint fails, no warning is shown and all existing flows continue unchanged.

## Presentation Status Check

When the credential is later used during presentation, the verifier follows the `status_list` claim embedded in the credential:

```json
{
  "status_list": {
    "idx": 0,
    "uri": "https://status-list-server.example/status-lists/{id}"
  }
}
```

The verifier fetches the status list token, validates its signature and certificate chain, and checks the credential index. If the credential was revoked, presentation validation should fail.

## Testing Checklist

1. Log in to the client app.
2. Confirm `Credential Offer` opens with `By reference` selected.
3. Toggle to `By value` and confirm the QR code and link are replaced in place.
4. Issue a credential to the wallet by scanning the QR code.
5. Open `Credentials`.
6. Confirm the issued credential appears with status `active`.
7. Click `Revoke`.
8. Confirm the dialog requires a revocation reason.
9. Submit the revocation.
10. Confirm the credential remains visible with status `revoked`.
11. Try presenting the revoked credential and confirm status validation rejects it.
12. Set `Max credentials per user` on the credential mapper in the Keycloak Admin Console and reach the cap.
13. Confirm the warning appears on the `Credential Offer` tab before scanning again.
14. Confirm a user below the cap sees no warning.
15. Revoke one credential and confirm the warning clears after the limits refresh.
