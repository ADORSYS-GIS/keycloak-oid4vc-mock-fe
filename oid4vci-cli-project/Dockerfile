# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=optional
COPY . .
RUN npm run build -- --configuration=production

# Runtime stage
FROM nginx:1.29.1-alpine-slim

# Install Node.js for runtime environment generation
RUN apk add --no-cache nodejs npm

WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist/oid4vc-client-ng-fe/browser .
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

COPY ./nginx.conf /etc/nginx/nginx.conf

ENV KEYCLOAK_URL=""
ENV KEYCLOAK_REALM=""
ENV KEYCLOAK_CLIENT_ID=""
ENV OID4VC_DEFAULT_CREDENTIAL_CONFIGURATION_ID=""
ENV PRODUCTION=""

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]


