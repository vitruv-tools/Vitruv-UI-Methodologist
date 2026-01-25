# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit

COPY . .

# Choose environment at build time:
#   docker build --build-arg BUILD_ENV=staging ...
# Defaults to production.
ARG BUILD_ENV=production

# Run the correct build command for your setup
RUN set -eux; \
    if [ "$BUILD_ENV" = "staging" ]; then \
      npm run build:staging; \
    elif [ "$BUILD_ENV" = "production" ]; then \
      npm run build:production; \
    elif [ "$BUILD_ENV" = "local" ]; then \
      npm run build; \
    else \
      echo "ERROR: Unknown BUILD_ENV='$BUILD_ENV' (use local|staging|production)"; \
      exit 1; \
    fi

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
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/out /usr/share/nginx/html