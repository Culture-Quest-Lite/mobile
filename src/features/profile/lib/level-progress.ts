import type { GamificationLevel } from "../api/get-levels";
import type { Profile } from "../types";

function normalizeName(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function findLevelIndexByProfile(
  profile: Profile,
  levels: readonly GamificationLevel[],
) {
  if (typeof profile.level === "number") {
    const matchedIndex = levels.findIndex(
      (level) => level.levelNumber === profile.level,
    );

    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  const normalizedLevelName = normalizeName(profile.levelName);

  if (normalizedLevelName) {
    const matchedIndex = levels.findIndex(
      (level) => normalizeName(level.name) === normalizedLevelName,
    );

    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  let matchedIndex = -1;

  for (let index = 0; index < levels.length; index += 1) {
    if (profile.totalXp >= levels[index].requiredXp) {
      matchedIndex = index;
      continue;
    }

    break;
  }

  return matchedIndex >= 0 ? matchedIndex : 0;
}

export function applyLevelProgressToProfile(
  profile: Profile,
  levels: readonly GamificationLevel[],
): Profile {
  if (levels.length === 0) {
    return profile;
  }

  const currentLevelIndex = findLevelIndexByProfile(profile, levels);
  const currentLevel = levels[currentLevelIndex];
  const nextLevel = levels[currentLevelIndex + 1];
  const resolvedLevelNumber =
    typeof profile.level === "number" ? profile.level : currentLevel.levelNumber;

  if (!nextLevel) {
    return {
      ...profile,
      currentLevelXp: null,
      level: resolvedLevelNumber,
      levelName: currentLevel.name,
      xpToNext: null,
    };
  }

  return {
    ...profile,
    currentLevelXp: Math.max(profile.totalXp, 0),
    level: resolvedLevelNumber,
    levelName: currentLevel.name,
    xpToNext: Math.max(nextLevel.requiredXp, Math.max(profile.totalXp, 0)),
  };
}
