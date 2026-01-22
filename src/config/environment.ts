/**
 * Environment Configuration
 * 
 * This file centralizes all environment-specific configuration.
 * Values are loaded from environment variables (REACT_APP_* prefix).
 * 
 * Environment files:
 * - .env.local (local development)
 * - .env.staging (staging builds)
 * - .env.production (production builds)
 */

interface EnvironmentConfig {
  apiBaseUrl: string;
  environment: 'local' | 'staging' | 'production';
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
}

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  if (!process.env.REACT_APP_API_BASE_URL) {
    throw new Error(
      'REACT_APP_API_BASE_URL is not defined. Please check your .env file.'
    );
  }
}

// Validate on module load
validateEnvironment();

/**
 * Environment configuration object
 * All environment-specific values should be accessed through this object
 */
export const config: EnvironmentConfig = {
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL!,
  environment: (process.env.REACT_APP_ENV || 'production') as EnvironmentConfig['environment'],
  isDevelopment: process.env.REACT_APP_ENV === 'local',
  isStaging: process.env.REACT_APP_ENV === 'staging',
  isProduction: process.env.REACT_APP_ENV === 'production',
};

// Log configuration in development (helps with debugging)
if (config.isDevelopment) {
  console.log('Environment Configuration:', {
    environment: config.environment,
    apiBaseUrl: config.apiBaseUrl,
  });
}

export default config;
