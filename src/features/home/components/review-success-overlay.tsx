import { SuccessOverlay } from "@/components/ui/success-overlay";

type ReviewSuccessMode = "created" | "updated";

export function ReviewSuccessOverlay({
  avatarUri,
  isPending,
  mode = "created",
  onClose,
  onContinueExplore,
  onViewPost,
}: {
  avatarUri: string;
  isPending: boolean;
  mode?: ReviewSuccessMode;
  onClose: () => void;
  onContinueExplore: () => void;
  onViewPost: () => void;
}) {
  const isUpdateSuccess = mode === "updated";

  return (
    <SuccessOverlay
      avatarUri={avatarUri}
      description={
        isUpdateSuccess
          ? "Bài đánh giá của bạn đã được cập nhật"
          : isPending
            ? "Bài đánh giá của bạn đã được gửi và đang chờ duyệt"
            : "Bài đánh giá của bạn đã được đăng lên cộng đồng"
      }
      note={
        isUpdateSuccess
          ? "Mọi người đã có thể xem nội dung mới nhất."
          : isPending
            ? "Bài sẽ hiển thị công khai ngay sau khi được duyệt."
            : "Mọi người đã có thể xem bài đánh giá của bạn."
      }
      onClose={onClose}
      onPrimaryAction={onViewPost}
      onSecondaryAction={onContinueExplore}
      primaryActionLabel="Xem bài đăng"
      secondaryActionLabel="Tiếp tục khám phá"
      title={isUpdateSuccess ? "Cập nhật thành công!" : "Đăng bài thành công!"}
    />
  );
}
