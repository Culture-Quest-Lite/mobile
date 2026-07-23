import type { GamificationLevel } from "../api/get-levels";
import type { Profile } from "../types";

function normalizeName(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function isLevelUnlocked(level: GamificationLevel, totalXp: number) {
  return totalXp >= level.requiredXp;
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
    if (isLevelUnlocked(levels[index], profile.totalXp)) {
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
  const currentLevelXp = Math.max(currentTotalXp - currentLevelRequiredXp, 0);
  const hasNextLevel =
    Boolean(nextLevel) &&
    typeof nextLevel?.requiredXp === "number" &&
    nextLevel.requiredXp > currentLevelRequiredXp;
  const nextLevelRequiredXp = hasNextLevel ? Math.max(nextLevel!.requiredXp, 0) : null;
  const remainingXpToNextLevel =
    nextLevelRequiredXp !== null
      ? Math.max(nextLevelRequiredXp - currentTotalXp, 0)
      : null;
  const levelProgressPercent =
    nextLevelRequiredXp !== null
      ? clampPercent(
          ((currentTotalXp - currentLevelRequiredXp) /
            Math.max(nextLevelRequiredXp - currentLevelRequiredXp, 1)) *
            100,
        )
      : null;

  // A missing next level usually means the user is already at the highest
  // configured XP threshold from the level catalog.
  if (!hasNextLevel) {
    return {
      ...profile,
      currentLevelRequiredXp,
      isMaxLevel: false,
      currentLevelXp,
      hasExactLevelProgress: false,
      level: resolvedLevelNumber,
      levelName: currentLevel.name,
      levelProgressPercent: null,
      nextLevelName: null,
      nextLevelNumber: null,
      nextLevelRequiredXp: null,
      remainingXpToNextLevel: null,
      xpToNext: null,
    };
  }

  return {
    ...profile,
    currentLevelRequiredXp,
    isMaxLevel: false,
    currentLevelXp,
    hasExactLevelProgress: true,
    level: resolvedLevelNumber,
    levelName: currentLevel.name,
    levelProgressPercent,
    nextLevelName: nextLevel!.name,
    nextLevelNumber: nextLevel!.levelNumber,
    nextLevelRequiredXp,
    remainingXpToNextLevel,
    xpToNext: Math.max(
      (nextLevelRequiredXp ?? currentLevelRequiredXp) - currentLevelRequiredXp,
      0,
    ),
  };
}
