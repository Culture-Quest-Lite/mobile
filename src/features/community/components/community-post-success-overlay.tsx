import { SuccessOverlay } from "@/components/ui/success-overlay";

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
}: {
  avatarFallbackLabel?: string;
  avatarUri?: string | null;
  onClose: () => void;
  onContinueExplore: () => void;
  onViewPost: () => void;
  rewardText?: string | null;
  variant: CommunityPostSuccessVariant;
}) {
  return (
    <SuccessOverlay
      avatarFallbackLabel={avatarFallbackLabel}
      avatarUri={avatarUri}
      description={
        variant === "pending"
          ? "Bài viết của bạn đã được gửi và đang chờ duyệt"
          : variant === "profileOnly"
            ? "Bài viết của bạn đã được lưu trong hồ sơ"
            : "Bài viết của bạn đã được đăng lên cộng đồng"
      }
      note={
        variant === "pending"
          ? "Bài sẽ hiển thị công khai ngay sau khi được duyệt."
          : variant === "profileOnly"
            ? "Chỉ những người trong phạm vi hiển thị bạn chọn mới xem được."
            : "Mọi người đã có thể xem bài viết của bạn."
      }
      onClose={onClose}
      onPrimaryAction={onViewPost}
      onSecondaryAction={onContinueExplore}
      primaryActionLabel="Xem bài đăng"
      rewardText={rewardText}
      secondaryActionLabel="Tiếp tục khám phá"
      title="Đăng bài thành công!"
    />
  );
}
