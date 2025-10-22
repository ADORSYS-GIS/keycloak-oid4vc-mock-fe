# oid4vc-client-ng-fe

Lean Angular SPA scaffold for OIDC (Keycloak) + OID4VC issuance.
- Angular: minimal, standalone components, SCSS, routing.
- Auth flow: **OIDC Authorization Code + PKCE (S256)** via Keycloak (SAML federation happens behind Keycloak).
- Goal: add a tiny login + callback, then OID4VC issuance (credential-offer → pre-authorized_code → credential).

## Prerequisites
- Node 18+ (recommend 20+): `node -v`
- npm 9+ (or pnpm)
- Angular CLI: `npm i -g @angular/cli`

## Install & Run (dev)
```bash
npm install
npm start
# http://localhost:4200