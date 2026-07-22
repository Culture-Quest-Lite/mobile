import Constants from "expo-constants";

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

export function hasExpoScheme() {
  return Boolean(readExpoScheme());
}
