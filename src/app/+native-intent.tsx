const fallbackNativeUrl = "culturequest://app";
const apiInviteHost = "api.culturequestlite.com";
const publicInviteHost = "culturequest.app";
const supportedSchemes = new Set(["culturequest:", "culturequestlitemobile:"]);

function isAuthCallbackUrl(url: URL) {
  const pathnameTokens = url.pathname.split("/").filter(Boolean);

  return (
    supportedSchemes.has(url.protocol) &&
    url.hostname === "auth" &&
    pathnameTokens[0] === "callback"
  );
}

function readInviteTokenFromUrl(url: URL) {
  const pathnameTokens = url.pathname.split("/").filter(Boolean);

  if (
    url.hostname === apiInviteHost &&
    pathnameTokens[0] === "api" &&
    pathnameTokens[1] === "v1" &&
    pathnameTokens[2] === "groups" &&
    pathnameTokens[3] === "join"
  ) {
    return pathnameTokens[4] ?? null;
  }

  if (url.hostname === publicInviteHost && pathnameTokens[0] === "join") {
    return pathnameTokens[1] ?? null;
  }

  if (supportedSchemes.has(url.protocol) && url.hostname === "join") {
    return pathnameTokens[0] ?? null;
  }

  return null;
}

export function redirectSystemPath({
  path,
}: {
  initial: boolean;
  path: string;
}) {
  try {
    const url = new URL(path, fallbackNativeUrl);

    // expo-web-browser mới là bên phải nhận redirect của Keycloak. Để expo-router
    // xử lý URL này thì nó điều hướng đi mất, promptAsync treo mãi không resolve
    // và bước sync tài khoản với backend không bao giờ chạy.
    if (isAuthCallbackUrl(url)) {
      return null;
    }

    const inviteToken = readInviteTokenFromUrl(url);

    if (!inviteToken) {
      return path;
    }

    return `/join/${encodeURIComponent(inviteToken)}`;
  } catch {
    return path;
  }
}
