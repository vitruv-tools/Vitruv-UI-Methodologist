# Environment Configuration

This project supports three different environments, each with its own API base URL and configuration.

## Environments

| Environment | API Base URL | Usage |
|-------------|--------------|-------|
| **Local** | `http://localhost:9811` | Development on your local machine |
| **Staging** | `https://fe3ab829-d558-4834-afcf-6ed7ca440ca4.ka.bw-cloud-instance.org` | Testing before production |
| **Production** | `https://mwa.sdq.kastel.kit.edu` | Live production environment |

## Configuration Files

The project uses environment-specific configuration files:

- `.env.local` - Local development (gitignored)
- `.env.staging` - Staging builds (committed to repository)
- `.env.production` - Production builds (committed to repository)
- `.env.example` - Template for creating new environment files

## Environment Variables

All environment variables use the `REACT_APP_` prefix as required by Create React App:

### `REACT_APP_API_BASE_URL`
**Required:** Yes  
**Description:** The base URL for the backend API  
**Examples:**
- Local: `http://localhost:9811`
- Staging: `https://fe3ab829-d558-4834-afcf-6ed7ca440ca4.ka.bw-cloud-instance.org`
- Production: `https://mwa.sdq.kastel.kit.edu`

### `REACT_APP_ENV`
**Required:** Yes  
**Description:** Environment identifier  
**Values:** `local` | `staging` | `production`

## Setup Instructions

### First Time Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` to match your local backend configuration:
   ```bash
   REACT_APP_API_BASE_URL=http://localhost:9811
   REACT_APP_ENV=local
   ```

### Development (Local)

Run the development server with local configuration:

```bash
npm start
```

This automatically uses `.env.local` for configuration.

### Building for Staging

Build the application for staging environment:

```bash
npm run build:staging
```

This uses `.env.staging` and creates an optimized production build configured for the staging environment.

### Building for Production

Build the application for production environment:

```bash
npm run build:production
```

This uses `.env.production` and creates an optimized production build configured for the production environment.

## How It Works

### Configuration Loading

The configuration is centralized in `src/config/environment.ts`:

```typescript
import { config } from './config/environment';

// Access configuration
console.log(config.apiBaseUrl);    // The API base URL
console.log(config.environment);   // 'local', 'staging', or 'production'
console.log(config.isDevelopment); // true in local environment
console.log(config.isStaging);     // true in staging environment
console.log(config.isProduction);  // true in production environment
```

### Using Configuration in Code

**Always use the config object, never hardcode URLs:**

✅ **Correct:**
```typescript
import { config } from '../config/environment';

const response = await fetch(`${config.apiBaseUrl}/api/v1/users`);
```

❌ **Incorrect:**
```typescript
// Never hardcode URLs
const response = await fetch('http://localhost:9811/api/v1/users');
```

### API Service

The `ApiService` class automatically uses the correct base URL:

```typescript
import { apiService } from './services/api';

// This automatically uses the correct environment URL
const users = await apiService.getUserInfo();
```

### Authentication Service

The `AuthService` class also uses the environment configuration:

```typescript
import { AuthService } from './services/auth';

// This automatically uses the correct environment URL
await AuthService.signIn({ username, password });
```

## Adding New Environment Variables

1. Add the variable to all environment files:
   - `.env.local`
   - `.env.staging`
   - `.env.production`
   - `.env.example`

2. Update the `EnvironmentConfig` interface in `src/config/environment.ts`:
   ```typescript
   interface EnvironmentConfig {
     apiBaseUrl: string;
     environment: 'local' | 'staging' | 'production';
     isDevelopment: boolean;
     isStaging: boolean;
     isProduction: boolean;
     // Add your new variable here
     newVariable: string;
   }
   ```

3. Add the variable to the config object:
   ```typescript
   export const config: EnvironmentConfig = {
     apiBaseUrl: process.env.REACT_APP_API_BASE_URL!,
     environment: (process.env.REACT_APP_ENV || 'production') as EnvironmentConfig['environment'],
     isDevelopment: process.env.REACT_APP_ENV === 'local',
     isStaging: process.env.REACT_APP_ENV === 'staging',
     isProduction: process.env.REACT_APP_ENV === 'production',
     // Add your new variable here
     newVariable: process.env.REACT_APP_NEW_VARIABLE!,
   };
   ```

4. Remember: All variables must start with `REACT_APP_` to be accessible in the React application.

## Troubleshooting

### Error: "REACT_APP_API_BASE_URL is not defined"

This means the environment variable is not set. Solutions:

1. Ensure you have a `.env.local` file in the project root
2. Verify the file contains `REACT_APP_API_BASE_URL=...`
3. Restart the development server (`npm start`)

### Changes to .env files not reflecting

Environment variables are only loaded when the development server starts. If you change a `.env` file:

1. Stop the development server (Ctrl+C)
2. Start it again (`npm start`)

### Wrong API URL being used

Check which environment file is being loaded:

1. In local development, `.env.local` is used
2. For builds, the build script determines which file is used:
   - `npm run build:staging` uses `.env.staging`
   - `npm run build:production` uses `.env.production`

Check the console output in development mode to see the loaded configuration.

## CI/CD Integration

The staging and production environment files are committed to the repository, making CI/CD straightforward:

```yaml
# Example GitHub Actions workflow
- name: Build for staging
  run: npm run build:staging

- name: Build for production
  run: npm run build:production
```

No additional environment variable configuration is needed in the CI/CD pipeline.

## Security Notes

- **Never commit `.env.local`** - This file is gitignored and may contain developer-specific settings
- `.env.staging` and `.env.production` contain no secrets and can be safely committed
- API authentication tokens are never stored in environment files
- All sensitive data (tokens, passwords) are managed at runtime or through secure secret management

## Migration from Hardcoded URLs

If you're migrating from hardcoded URLs:

1. ✅ All API calls already use `config.apiBaseUrl` via the `ApiService` and `AuthService` classes
2. ✅ No hardcoded URLs exist in the codebase
3. ✅ Environment-specific configuration is centralized in `src/config/environment.ts`

The migration is complete! All URLs are now properly managed through environment configuration.
