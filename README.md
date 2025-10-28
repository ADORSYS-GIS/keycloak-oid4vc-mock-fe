# Keycloak SSO & OID4VC Demo

This project is a React application that demonstrates how to integrate Keycloak for Single Sign-On (SSO) and interact with an OID4VC (OpenID for Verifiable Credentials) service. It provides a basic setup for user authentication and a protected dashboard page.

## Features

*   **User Authentication:** Login and logout functionality using Keycloak SSO.
*   **Protected Routes:** A dashboard page that is only accessible to authenticated users.
*   **OID4VC Integration:** A service to interact with an OID4VC provider.
*   **Modern Tech Stack:** Built with React, Vite, and Tailwind CSS.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   [npm](https://yarnpkg.com/) package manager
*   A running Keycloak instance with a configured realm and client.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/keycloak-sso.git
    cd keycloak-sso
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Create a `.env` file in the root of the project by copying the `.env.example` file (if it exists) or by creating a new one.

2.  Add the following environment variables to your `.env` file and replace the values with your Keycloak and OID4VC configuration:

    ```env
    VITE_KEYCLOAK_URL=https://your-keycloak-instance.com
    VITE_KEYCLOAK_REALM=your-realm
    VITE_KEYCLOAK_CLIENT_ID=your-client-id
    VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID=your-credential-config-id
    ```

### Running the Application

To start the development server, run the following command:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Available Scripts

In the project directory, you can run:

*   `npm run dev`: Runs the app in the development mode.
*   `npm run build`: Builds the app for production to the `dist` folder.
*   `npm run lint`: Lints the codebase using ESLint.
*   `npm run preview`: Serves the production build locally for preview.

