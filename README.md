# Keycloak SSO & OID4VC Demo

[![CI](https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/actions/workflows/ci.yml/badge.svg)](https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/ADORSYS-GIS/keycloak-oid4vc-mock-fe?label=latest%20release)](https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/releases/latest)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/badge)](https://scorecard.dev/viewer/?uri=github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe)
[![Container](https://img.shields.io/badge/ghcr.io-container-2496ED)](https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/pkgs/container/keycloak-oid4vc-mock-fe)
[![License](https://img.shields.io/github/license/ADORSYS-GIS/keycloak-oid4vc-mock-fe)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/ADORSYS-GIS/keycloak-oid4vc-mock-fe?label=stars)](https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/stargazers)
[![Commit activity](https://img.shields.io/github/commit-activity/m/ADORSYS-GIS/keycloak-oid4vc-mock-fe?label=commit%20activity)](https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe/commits/main)

This project is a React application that demonstrates how to integrate Keycloak for Single Sign-On (SSO) and interact with an OID4VC (OpenID for Verifiable Credentials) service. It provides a basic setup for user authentication and a protected dashboard page.

![Credential Portal showing a credential offer QR code](docs/assets/credential-portal.png)

## Features

- **User Authentication:** Login and logout functionality using Keycloak SSO.
- **Protected Routes:** A dashboard page that is only accessible to authenticated users.
- **OID4VC Integration:** A service to interact with an OID4VC provider.
- **Issued Credential Revocation:** A client-driven flow for revoking issued credentials through Keycloak.
- **Modern Tech Stack:** Built with React, Vite, and Tailwind CSS.

## Flow Documentation

- [Credential issuance and revocation flow](docs/credential-issuance-and-revocation-flow.md)

## Architecture

These diagrams show the main flows handled by the client application. Keycloak and the Status List Server are external to the application and are shown as separate components to make the integration boundaries clear.

### Issuance

The flow starts with user authentication. After login, the Credential Offer flow is opened. The application obtains the credential offer from Keycloak and displays it as either a QR code or a link, supporting both by-reference and by-value offers. The application also displays a warning when the issuance limit is reached.

The Credentials view lists the credentials issued to the user. The application retrieves the credential status through the credential status flow and displays it as Valid, Revoked, Suspended, or Unknown. The Status List Server is responsible for providing the status information used to determine the current state of a credential.

For a Valid credential, the user can open the revocation dialog, provide a reason, and submit the revocation request. The resulting status change is reflected through the Status List Server.

![Issuance in the mock frontend](docs/assets/architecture-issuance.png)

### Presentation

The presentation flow starts with authentication, which redirects the browser to Keycloak. The AuthProvider checks the authentication session and maintains the access token. Once the session is authenticated, the user is redirected to the Dashboard.

Wallet-based sign-in is handled through the Keycloak login theme. It is therefore part of the Keycloak authentication flow and is not a screen rendered by this application.

The Status List Server is also part of the credential verification flow, providing the status information required when checking whether a presented credential is currently valid.

![Presentation in the mock frontend](docs/assets/architecture-presentation.png)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v22 or higher)
- [npm](https://www.npmjs.com/) package manager
- A running Keycloak instance with a configured realm and client.

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/ADORSYS-GIS/keycloak-oid4vc-mock-fe.git
    cd keycloak-oid4vc-mock-fe
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

### Configuration

1. Using `.env.example` as a template, create a `.env` file in the root of the project and update the variables with the correct values:
   ```bash
   cp .env.example .env
   ```

The configuration variables are:

| Variable                                          | Description                                                                                                                                                        | Default |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `VITE_KEYCLOAK_URL`                               | URL of the Keycloak instance.                                                                                                                                      | -       |
| `VITE_KEYCLOAK_REALM`                             | Keycloak realm to use.                                                                                                                                             | -       |
| `VITE_KEYCLOAK_CLIENT_ID`                         | Keycloak public client ID.                                                                                                                                         | -       |
| `VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID` | Default credential configuration ID for the OID4VC issuance flow.                                                                                                  | -       |
| `VITE_OID4VC_PRE_AUTHORIZED`                      | Whether to use pre-authorized credential offers.                                                                                                                   | -       |
| `VITE_BASE_PATH`                                  | Base path under which the app is served, e.g. `/mock-fe/` when the app runs behind a reverse proxy at `https://example.com/mock-fe/`. Must start and end with `/`. | `/`     |

### Running the Application

To start the development server, run the following command:

```bash
npm run dev
```

The application will be available at `http://localhost:4200`.

### Deploying under a sub-path

By default the app is built to be served from the domain root. To serve it under a sub-path (for example `/mock-fe/` for a customer workshop), set `VITE_BASE_PATH` at build time:

```bash
VITE_BASE_PATH=/mock-fe/ npm run build
```

All asset URLs, the `config.js` reference and the client-side routing are then resolved relative to `/mock-fe/`. The value is read from the shell environment, CI environment, or a `VITE_BASE_PATH` entry in `.env`.

## Run with Docker

The published image listens on port `8080`.

Use the `-e` flag only for environment variables you want to override. If you omit a variable, the application uses the default value provided by the image:

- **Keycloak URL:** `https://keycloak-demo.solutions.adorsys.com`
- **Keycloak realm:** `oid4vc-vci`
- **Keycloak client ID:** `oid4vc-demo-public`
- **Credential configuration ID:** `DatevCompanyCredential`
- **Pre-authorized offers:** enabled

For example:

```bash
docker run --rm -p 8080:8080 \
  -e VITE_KEYCLOAK_URL=https://your-keycloak-instance.com \
  -e VITE_KEYCLOAK_REALM=your-realm \
  -e VITE_KEYCLOAK_CLIENT_ID=your-client-id \
  -e VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID=your-credential-config-id \
  -e VITE_OID4VC_PRE_AUTHORIZED=true \
  ghcr.io/adorsys-gis/keycloak-oid4vc-mock-fe:latest
```

The application will be available at:

`http://localhost:8080`

### Deploying the Docker image under a sub-path

The base path is baked into the static assets at image build time. To serve the image under a sub-path (for example `/mock-fe/` behind a reverse proxy), build the image with `VITE_BASE_PATH`:

```bash
docker build --build-arg VITE_BASE_PATH=/mock-fe/ -t keycloak-oid4vc-mock-fe:mock-fe .
```

The `VITE_KEYCLOAK_*` settings can still be overridden at container start with `-e` flags, as shown above.

## Available Scripts

In the project directory, you can run:

- `npm run dev`: Runs the app in the development mode.
- `npm run build`: Builds the app for production to the `dist` folder.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run preview`: Serves the production build locally for preview.

## Compatibility

This application has been tested with:

| **Requirement** | **Version** |
| --------------- | ----------- |
| **Keycloak**    | 26.7.3      |

While it may work with other versions, compatibility is not guaranteed. Ensure your environment matches the tested versions for best results.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). The current version is `0.1.0`, defined in `package.json`.

Releases are identified by Git tags in the format `vX.Y.Z`, matching the version in `package.json`.

To create a release:

1. Bump the `version` field in `package.json`.
2. Commit the version change.
3. Tag that commit as `vX.Y.Z`.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only).
See [LICENSE](./LICENSE) for details.
