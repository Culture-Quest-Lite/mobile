const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
const keycloakUrl = process.env.EXPO_PUBLIC_KEYCLOAK_URL?.trim() ?? '';
const keycloakRealm = process.env.EXPO_PUBLIC_KEYCLOAK_REALM?.trim() ?? '';
const keycloakClientId = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID?.trim() ?? '';
const googleRedirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim() ?? '';

function normalizeUrlPart(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeApiBaseUrl(value: string) {
  const normalizedValue = normalizeUrlPart(value.trim());

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.replace(/\/swagger-ui(?:\/index\.html)?$/i, '');
}

const apiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);

export const PublicEnv = {
  apiBaseUrl,
  keycloakClientId,
  keycloakRealm,
  keycloakUrl,
  googleRedirectUri,
} as const;

export function buildApiUrl(path: string) {
  if (!PublicEnv.apiBaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL in the mobile .env file.');
  }

  const normalizedBaseUrl = normalizeUrlPart(PublicEnv.apiBaseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const resolvedPath =
    normalizedBaseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')
      ? normalizedPath.slice(4)
      : normalizedPath;

  return `${normalizedBaseUrl}${resolvedPath}`;
}

function collectEnvWarnings() {
  const warnings: string[] = [];

  if (!rawApiBaseUrl) {
    warnings.push('EXPO_PUBLIC_API_BASE_URL is missing.');
  } else if (rawApiBaseUrl.includes('192.168.x.x')) {
    warnings.push('EXPO_PUBLIC_API_BASE_URL still uses the placeholder LAN IP.');
  } else if (/\/swagger-ui(?:\/index\.html)?$/i.test(rawApiBaseUrl)) {
    warnings.push('EXPO_PUBLIC_API_BASE_URL should point to the API host, not the Swagger UI page.');
  }

  if (!PublicEnv.keycloakUrl) {
    warnings.push('EXPO_PUBLIC_KEYCLOAK_URL is missing.');
  } else if (PublicEnv.keycloakUrl.includes('192.168.x.x')) {
    warnings.push('EXPO_PUBLIC_KEYCLOAK_URL still uses the placeholder LAN IP.');
  }

  if (!PublicEnv.keycloakRealm) {
    warnings.push('EXPO_PUBLIC_KEYCLOAK_REALM is missing.');
  }

  if (!PublicEnv.keycloakClientId) {
    warnings.push('EXPO_PUBLIC_KEYCLOAK_CLIENT_ID is missing.');
  }

  if (!PublicEnv.googleRedirectUri) {
    warnings.push('EXPO_PUBLIC_GOOGLE_REDIRECT_URI is missing.');
  }

  return warnings;
}

let didWarnAboutPublicEnv = false;

export function warnForInvalidPublicEnv() {
  if (!__DEV__ || didWarnAboutPublicEnv) {
    return;
  }

  didWarnAboutPublicEnv = true;

  const warnings = collectEnvWarnings();

  if (warnings.length === 0) {
    return;
  }

  console.warn(`[env] ${warnings.join(' ')}`);
}
