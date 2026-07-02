import type { GamificationLevel } from "../api/get-levels";
import type { Profile } from "../types";

function normalizeName(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function findLevelIndexByMetadata(
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

  return -1;
}

function findLevelIndexByTotalXp(
  profile: Profile,
  levels: readonly GamificationLevel[],
) {
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

  const metadataLevelIndex = findLevelIndexByMetadata(profile, levels);
  const xpLevelIndex = findLevelIndexByTotalXp(profile, levels);
  const currentLevelIndex = Math.max(metadataLevelIndex, xpLevelIndex);
  const currentLevel = levels[currentLevelIndex];
  const nextLevel = levels[currentLevelIndex + 1];
  const resolvedLevelNumber = currentLevel.levelNumber;
  const currentTotalXp = Math.max(profile.totalXp, 0);
  const currentLevelRequiredXp = Math.max(currentLevel.requiredXp, 0);

  if (!nextLevel) {
    return {
      ...profile,
      isMaxLevel: true,
      currentLevelXp: null,
      level: resolvedLevelNumber,
      levelName: currentLevel.name,
      xpToNext: null,
    };
  }

  return {
    ...profile,
    isMaxLevel: false,
    currentLevelXp: Math.max(currentTotalXp - currentLevelRequiredXp, 0),
    level: resolvedLevelNumber,
    levelName: currentLevel.name,
    xpToNext: Math.max(nextLevel.requiredXp - currentLevelRequiredXp, 0),
  };
}
