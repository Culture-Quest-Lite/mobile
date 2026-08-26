import { SuccessOverlay } from "@/components/ui/success-overlay";

import type { RouteCompletionBonusDto } from "../api/route-api";

function formatBonusValue(value: number) {
  return value.toLocaleString("vi-VN");
}

function buildRewardText(bonus: RouteCompletionBonusDto) {
  const rewardParts = [
    ...(bonus.point > 0 ? [`+${formatBonusValue(bonus.point)} điểm`] : []),
    ...(bonus.xp > 0 ? [`+${formatBonusValue(bonus.xp)} XP`] : []),
  ];

  return rewardParts.length > 0 ? rewardParts.join(" · ") : null;
}

export function RouteCompletionOverlay({
  avatarUri,
  bonus,
  onClose,
  onContinueExplore,
  onViewRoute,
}: {
  avatarUri?: string | null;
  bonus: RouteCompletionBonusDto;
  onClose: () => void;
  onContinueExplore?: () => void;
  onViewRoute: () => void;
}) {
  const rewardText = buildRewardText(bonus);
  const routeName = bonus.routeName.trim();

  return (
    <SuccessOverlay
      avatarBadgeIcon={{
        ios: "trophy.fill",
        android: "emoji_events",
        web: "emoji_events",
      }}
      avatarUri={avatarUri}
      description={
        routeName
          ? `Bạn đã hoàn thành tuyến ${routeName}`
          : "Bạn đã hoàn thành tuyến này"
      }
      note={
        rewardText
          ? "Phần thưởng đã được cộng vào tài khoản của bạn."
          : "Cảm ơn bạn đã đi hết hành trình!"
      }
      onClose={onClose}
      onPrimaryAction={onViewRoute}
      onSecondaryAction={onContinueExplore}
      primaryActionLabel="Xem tuyến"
      rewardText={rewardText}
      secondaryActionLabel={onContinueExplore ? "Tiếp tục khám phá" : null}
      title="Hoàn thành tuyến!"
    />
  );
}
