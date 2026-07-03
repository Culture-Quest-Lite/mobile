import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const NATIVE_STORAGE_DIRECTORY_NAME = "culture-quest-lite";
const WEB_STORAGE_PREFIX = "culture-quest-lite:";

function getNativeStorageFile(key: string) {
  return new File(Paths.document, NATIVE_STORAGE_DIRECTORY_NAME, `${key}.json`);
}

function readRawStoredValue(key: string) {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(`${WEB_STORAGE_PREFIX}${key}`) ?? null;
    } catch (error) {
      console.warn("[storage] web read failed", {
        error: error instanceof Error ? error.message : error,
        key,
      });
      return null;
    }
  }

  try {
    const file = getNativeStorageFile(key);
    return file.exists ? file.textSync() : null;
  } catch (error) {
    console.warn("[storage] native read failed", {
      error: error instanceof Error ? error.message : error,
      key,
    });
    return null;
  }
}

function writeRawStoredValue(key: string, value: string) {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(`${WEB_STORAGE_PREFIX}${key}`, value);
    } catch (error) {
      console.warn("[storage] web write failed", {
        error: error instanceof Error ? error.message : error,
        key,
      });
    }
    return;
  }

  try {
    const directory = new Directory(Paths.document, NATIVE_STORAGE_DIRECTORY_NAME);

    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const file = getNativeStorageFile(key);

    if (!file.exists) {
      file.create({ intermediates: true });
    }

    file.write(value);
  } catch (error) {
    console.warn("[storage] native write failed", {
      error: error instanceof Error ? error.message : error,
      key,
    });
  }
}

export function readStoredJson<T>(key: string, fallbackValue: T): T {
  const rawValue = readRawStoredValue(key);

  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.warn("[storage] json parse failed", {
      error: error instanceof Error ? error.message : error,
      key,
    });
    return fallbackValue;
  }
}

export function writeStoredJson(key: string, value: unknown) {
  try {
    writeRawStoredValue(key, JSON.stringify(value));
  } catch (error) {
    console.warn("[storage] json stringify failed", {
      error: error instanceof Error ? error.message : error,
      key,
    });
  }
}
