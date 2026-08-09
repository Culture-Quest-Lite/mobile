import { SuccessOverlay } from "@/components/ui/success-overlay";
import {
  getPostVisibilityIcon,
  type PostVisibilityValue,
} from "@/lib/post-visibility";

export type CommunityPostSuccessVariant =
  | "approved"
  | "pending"
  | "profileOnly";

export function CommunityPostSuccessOverlay({
  avatarFallbackLabel,
  avatarUri,
  onClose,
  onContinueExplore,
  onViewPost,
  rewardText,
  variant,
  visibility,
}: {
  avatarFallbackLabel?: string;
  avatarUri?: string | null;
  onClose: () => void;
  onContinueExplore: () => void;
  onViewPost: () => void;
  rewardText?: string | null;
  variant: CommunityPostSuccessVariant;
  visibility?: PostVisibilityValue | string | null;
}) {
  return (
    <SuccessOverlay
      avatarBadgeIcon={getPostVisibilityIcon(visibility)}
      avatarBadgeVariant="outline"
      avatarFallbackLabel={avatarFallbackLabel}
      avatarUri={avatarUri}
      rewardText={rewardText}
      description={
        variant === "pending"
          ? "Bài viết của bạn đã được gửi và đang chờ duyệt"
          : variant === "profileOnly"
            ? "Bài viết của bạn đã được lưu trong hồ sơ"
            : "Bài viết của bạn đã được đăng lên cộng đồng"
      }
      note={
        variant === "pending"
          ? rewardText
            ? "Bài sẽ hiển thị công khai và điểm thưởng sẽ được cộng ngay sau khi bài viết được duyệt."
            : "Bài sẽ hiển thị công khai ngay sau khi được duyệt."
          : variant === "profileOnly"
            ? "Chỉ những người trong phạm vi bạn bè mới xem được."
            : "Mọi người đã có thể xem bài viết của bạn."
      }
      onClose={onClose}
      onPrimaryAction={onViewPost}
      onSecondaryAction={onContinueExplore}
      primaryActionLabel="Xem bài đăng"
      secondaryActionLabel="Tiếp tục khám phá"
      title="Đăng bài thành công!"
    />
  );
}
