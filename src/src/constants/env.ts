const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
const keycloakUrl = process.env.EXPO_PUBLIC_KEYCLOAK_URL?.trim() ?? '';
const keycloakRealm = process.env.EXPO_PUBLIC_KEYCLOAK_REALM?.trim() ?? '';
const keycloakClientId = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID?.trim() ?? '';
const googleRedirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim() ?? '';
const devLatitude = process.env.EXPO_PUBLIC_DEV_LATITUDE?.trim() ?? '';
const devLongitude = process.env.EXPO_PUBLIC_DEV_LONGITUDE?.trim() ?? '';
const goongApiKey = process.env.EXPO_PUBLIC_GOONG_API_KEY?.trim() ?? '';

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
  devLatitude,
  devLongitude,
  keycloakClientId,
  keycloakRealm,
  keycloakUrl,
  googleRedirectUri,
  goongApiKey,
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

  if (!PublicEnv.goongApiKey) {
    warnings.push('EXPO_PUBLIC_GOONG_API_KEY is missing. Route polyline will fall back to straight lines.');
  }

  if (Boolean(PublicEnv.devLatitude) !== Boolean(PublicEnv.devLongitude)) {
    warnings.push(
      'Set both EXPO_PUBLIC_DEV_LATITUDE and EXPO_PUBLIC_DEV_LONGITUDE to enable the dev mock location.',
    );
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
