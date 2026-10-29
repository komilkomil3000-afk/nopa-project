// Centralised JWT secret access. There are deliberately NO fallback values:
// a missing or weak secret must stop the server instead of silently falling
// back to a string that is public in the repository.
//
// Secrets are read lazily (at call time) because dotenv.config() runs in
// server.ts after the imports have been evaluated.

const MIN_SECRET_LENGTH = 32;

// Values that used to be hard-coded fallbacks in the code base. They are
// public, so they are rejected even if someone puts them in the environment.
const KNOWN_LEAKED_SECRETS = new Set([
  'nopa_super_secret_jwt_key_2026',
  'nopa_super_secret_refresh_jwt_key_2026',
]);

function readSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters long`);
  }
  if (KNOWN_LEAKED_SECRETS.has(value)) {
    throw new Error(`${name} uses a publicly known value; generate a new random secret`);
  }
  return value;
}

export function getJwtSecret(): string {
  return readSecret('JWT_SECRET');
}

export function getJwtRefreshSecret(): string {
  const refresh = readSecret('JWT_REFRESH_SECRET');
  if (refresh === process.env.JWT_SECRET) {
    throw new Error('JWT_REFRESH_SECRET must differ from JWT_SECRET');
  }
  return refresh;
}

/** Call once at startup (after dotenv.config()) so misconfiguration fails fast. */
export function assertSecretsConfigured(): void {
  getJwtSecret();
  getJwtRefreshSecret();
}
