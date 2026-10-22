# Quick Reference - Environment Configuration

## Commands

### Local Development
```bash
npm start
```
Uses `.env.local` (or falls back to `.env` if not present)

### Build for Staging
```bash
npm run build:staging
```
Uses `.env.staging` - creates production build for staging environment

### Build for Production
```bash
npm run build:production
```
Uses `.env.production` - creates production build for production environment

## Environment URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:9811` |
| Staging | `https://fe3ab829-d558-4834-afcf-6ed7ca440ca4.ka.bw-cloud-instance.org` |
| Production | `https://mwa.sdq.kastel.kit.edu` |

## First Time Setup

```bash
# 1. Copy example environment file
cp .env.example .env.local

# 2. Install dependencies
npm install

# 3. Start development server
npm start
```

## Environment Variables

- `REACT_APP_API_BASE_URL` - Backend API base URL
- `REACT_APP_ENV` - Environment identifier (local, staging, production)

## Using Configuration in Code

```typescript
import { config } from './config/environment';

// Access configuration
const apiUrl = config.apiBaseUrl;
const environment = config.environment;

// Check environment
if (config.isDevelopment) {
  console.log('Running in development mode');
}
```

## Troubleshooting

### Environment changes not reflecting
Restart the development server:
```bash
# Stop with Ctrl+C, then:
npm start
```

### Missing REACT_APP_API_BASE_URL error
Create `.env.local`:
```bash
cp .env.example .env.local
```

### Wrong API URL being used
Check which environment file is active:
- `npm start` uses `.env.local`
- `npm run build:staging` uses `.env.staging`
- `npm run build:production` uses `.env.production`

## Files

- **`.env.local`** - Your local config (gitignored)
- **`.env.staging`** - Staging config (committed)
- **`.env.production`** - Production config (committed)
- **`.env.example`** - Template (committed)

## Documentation

- **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Complete setup guide
- **[ENVIRONMENT_MIGRATION.md](./ENVIRONMENT_MIGRATION.md)** - Migration summary
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Authentication documentation
- **[README.md](./README.md)** - General project documentation
