# Builds the website (React frontend) and serves it with Caddy. Caddy also forwards /api and
# /media to the Java server, so the website and the server share one address (needed for login).
FROM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js ./
COPY public public
COPY src src
# The website reads the default site content from the server's copy.
COPY server/src/main/resources/content/defaults.json server/src/main/resources/content/defaults.json
# The public address of the store, e.g. https://code76.in (baked into the website at build time).
ARG SITE_URL
RUN test -n "$SITE_URL" || (echo "SITE_URL is missing from deploy/.env" && exit 1)
ENV VITE_API_BASE_URL=$SITE_URL
RUN npm run build

FROM caddy:2
COPY --from=build /web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
