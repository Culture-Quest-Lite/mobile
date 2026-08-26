type BuildLevelProgressBarStateInput = {
  currentXp: number;
  currentLevelLabel: string;
  currentLevelXp?: number | null;
  isMaxLevel?: boolean;
  xpToNext?: number | null;
};

export type LevelProgressBarState = {
  currentXp: number;
  fillPercent: number;
  markerLabel: string;
  remainingXp: number;
  targetXp: number | null;
};

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function formatXp(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

export function buildLevelProgressBarState({
  currentXp,
  currentLevelLabel,
  currentLevelXp,
  isMaxLevel = false,
  xpToNext,
}: BuildLevelProgressBarStateInput): LevelProgressBarState {
  const resolvedCurrentXp = Math.max(0, Math.round(currentXp));

  if (isMaxLevel) {
    return {
      currentXp: resolvedCurrentXp,
      fillPercent: 100,
      markerLabel: `${currentLevelLabel} · ${formatXp(resolvedCurrentXp)} XP`,
      remainingXp: 0,
      targetXp: null,
    };
  }

  const resolvedCurrentLevelXp =
    typeof currentLevelXp === "number" && Number.isFinite(currentLevelXp)
      ? Math.max(0, Math.round(currentLevelXp))
      : null;
  const resolvedXpToNext =
    typeof xpToNext === "number" && Number.isFinite(xpToNext)
      ? Math.max(0, Math.round(xpToNext))
      : null;
  const currentLevelStartXp =
    resolvedCurrentLevelXp !== null
      ? Math.max(resolvedCurrentXp - resolvedCurrentLevelXp, 0)
      : 0;
  const targetXp =
    resolvedXpToNext !== null && resolvedXpToNext > 0
      ? currentLevelStartXp + resolvedXpToNext
      : null;
  const fillPercent =
    targetXp !== null && targetXp > 0
      ? clampPercent((resolvedCurrentXp / targetXp) * 100)
      : 0;
  const remainingXp =
    targetXp !== null ? Math.max(targetXp - resolvedCurrentXp, 0) : 0;

  return {
    currentXp: resolvedCurrentXp,
    fillPercent,
    markerLabel: `${currentLevelLabel} · ${formatXp(resolvedCurrentXp)} XP`,
    remainingXp,
    targetXp,
  };
}
