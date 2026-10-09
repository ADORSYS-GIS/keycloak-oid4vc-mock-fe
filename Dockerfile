FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_KEYCLOAK_URL=https://keycloak-demo.solutions.adorsys.com
ARG VITE_KEYCLOAK_REALM=oid4vc-vci
ARG VITE_KEYCLOAK_CLIENT_ID=oid4vc-demo-public
ARG VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID=DatevCompanyCredential
ARG VITE_OID4VC_PRE_AUTHORIZED=true

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID=$VITE_OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID
ENV VITE_OID4VC_PRE_AUTHORIZED=$VITE_OID4VC_PRE_AUTHORIZED

RUN npm run build

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/runtime-entrypoint.sh /runtime-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

ENTRYPOINT ["sh", "/runtime-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
