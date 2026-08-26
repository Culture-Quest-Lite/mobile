import {
  getUserRouteProgressById,
  getUserRouteProgressList,
  type UserRouteProgressDto,
} from "@/features/route/api/route-api";

type GetCheckedInHotspotsRequest = {
  accessToken: string;
  tokenType?: string | null;
};

const routeProgressPageSize = 100;
const maxRouteProgressPages = 20;

/**
 * Backend chỉ expose GET /api/v1/route-participants (danh sách) và
 * /api/v1/route-participants/{id} (chi tiết kèm hotspotProgressList).
 * Không có GET /api/v1/user-hotspot-progress — path đó chỉ nhận POST, còn
 * /api/v1/user-route-progress không tồn tại; gọi vào sẽ nhận 500
 * "Đã xảy ra lỗi hệ thống".
 */
async function fetchAllRouteProgressSummaries({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest) {
  const summaries: UserRouteProgressDto[] = [];
  let currentPage = 0;
  let totalPages = 1;

  while (currentPage < totalPages && currentPage < maxRouteProgressPages) {
    const progressPage = await getUserRouteProgressList({
      accessToken,
      page: currentPage,
      size: routeProgressPageSize,
      tokenType,
    });

    summaries.push(...progressPage.content);

    if (progressPage.content.length === 0) {
      break;
    }

    totalPages = Math.max(progressPage.totalPages, 1);
    currentPage += 1;
  }

  return summaries;
}

async function fetchHotspotProgressList({
  accessToken,
  summary,
  tokenType,
}: GetCheckedInHotspotsRequest & { summary: UserRouteProgressDto }) {
  // Danh sách trả về RouteParticipantResponse (không có hotspotProgressList),
  // nên phải lấy chi tiết; nếu server đã kèm sẵn thì bỏ qua request thừa.
  if (summary.hotspotProgressList.length > 0) {
    return summary.hotspotProgressList;
  }

  const progressDetail = await getUserRouteProgressById({
    accessToken,
    progressId: summary.userRouteProgressId,
    tokenType,
  });

  return progressDetail.hotspotProgressList;
}

export async function getCheckedInHotspotIds({
  accessToken,
  tokenType,
}: GetCheckedInHotspotsRequest): Promise<number[]> {
  const summaries = await fetchAllRouteProgressSummaries({
    accessToken,
    tokenType,
  });
  const checkedInHotspotIds = new Set<number>();

  for (const summary of summaries) {
    let hotspotProgressList;

    try {
      hotspotProgressList = await fetchHotspotProgressList({
        accessToken,
        summary,
        tokenType,
      });
    } catch (error) {
      // Một tuyến lỗi không nên làm hỏng trạng thái check-in của các tuyến khác.
      console.info("[checkin-sync] bỏ qua tiến độ tuyến lỗi", {
        error: error instanceof Error ? error.message : error,
        userRouteProgressId: summary.userRouteProgressId,
      });
      continue;
    }

    for (const hotspotProgress of hotspotProgressList) {
      if (hotspotProgress.isCheckedIn) {
        checkedInHotspotIds.add(hotspotProgress.hotspotId);
      }
    }
  }

  return Array.from(checkedInHotspotIds);
}
