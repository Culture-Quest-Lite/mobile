import Constants from "expo-constants";

const DEFAULT_EXPO_SCHEME = "culturequestlitemobile";

type ExpoConfigLike = {
  scheme?: unknown;
  android?: {
    scheme?: unknown;
  } | null;
  ios?: {
    scheme?: unknown;
  } | null;
};

function readSchemeCandidate(candidate: unknown) {
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }

  if (Array.isArray(candidate)) {
    for (const value of candidate) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

export function readExpoScheme() {
  const expoConfig = Constants.expoConfig as ExpoConfigLike | null;

  return (
    readSchemeCandidate(expoConfig?.scheme) ||
    readSchemeCandidate(expoConfig?.android?.scheme) ||
    readSchemeCandidate(expoConfig?.ios?.scheme)
  );
}

export function getPreferredExpoScheme() {
  return readExpoScheme() || DEFAULT_EXPO_SCHEME;
}

export function hasExpoScheme() {
  return Boolean(readExpoScheme());
}
