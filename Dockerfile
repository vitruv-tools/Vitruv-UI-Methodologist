# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit

COPY . .
# build the app
RUN npm run build

# normalize output dir to /app/out (supports Vite 'dist' or CRA 'build')
RUN set -eux; \
    if [ -d dist ]; then \
      cp -r dist out; \
    elif [ -d build ]; then \
      cp -r build out; \
    else \
      echo "ERROR: No build output dir found (looked for 'dist' and 'build')."; \
      echo "Listing /app after build:"; ls -la; \
      exit 1; \
    fi; \
    ls -la out

# ---------- runtime stage ----------
FROM nginx:1.27-alpine
# nginx config (we already created frontend/docker/nginx.conf earlier)
COPY docker/nginx.conf /etc/nginx/nginx.conf
# built static assets
COPY --from=build /app/out /usr/share/nginx/html
