# Empty States Library

## Purpose

Empty states are part of product trust. They should explain what is missing, why it matters, and what the user can do next.

Use copy rules from [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) and component rules from [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md).

## Empty state anatomy

1. Icon or illustration: calm, small, non-decorative.
2. Title: direct statement.
3. Description: reason and impact.
4. CTA: one useful next step if available.
5. Secondary detail: timestamp, station ID, or filter context when relevant.

## Illustration rules

- Use simple line icons or quiet illustrations.
- Do not use sad faces, cartoons, mascots, or dramatic warning art.
- Do not use red illustration unless the state is genuinely high risk.
- Empty state illustration is optional; copy is required.

## No stations

- **Title:** `Chưa có trạm nào`
- **Description:** `Hệ thống chưa có trạm quan trắc được cấu hình cho khu vực này.`
- **CTA:** `Thêm trạm` for admin, none for public unless pilot context exists.
- **Use on:** public dashboard, admin station list.
- **Do not:** show fake stations unless demo mode is clearly labeled.

## No readings

- **Title:** `Chưa có dữ liệu đo`
- **Description:** `Trạm chưa gửi bản tin đầu tiên hoặc dữ liệu đang được đồng bộ.`
- **CTA:** `Thử lại`
- **Use on:** station detail, chart, metric cards.
- **Secondary detail:** expected reporting interval if known.

## No alerts

- **Title:** `Không có cảnh báo mới`
- **Description:** `Các trạm hiện chưa có vấn đề cần xử lý.`
- **CTA:** none by default.
- **Use on:** admin overview, alert queue.
- **Tone:** reassuring, not celebratory.

## No reports

- **Title:** `Chưa có báo cáo cộng đồng`
- **Description:** `Khi người dân gửi báo cáo, nội dung sẽ xuất hiện tại đây để được xem xét.`
- **CTA:** `Gửi báo cáo` on public pages, none or `Tạo ghi chú` on admin if supported.
- **Use on:** report lists, station detail.

## Offline station

- **Title:** `Trạm đang mất kết nối`
- **Description:** `Trạm chưa gửi dữ liệu mới trong {duration}. Dữ liệu gần nhất được ghi nhận lúc {time}.`
- **CTA:** `Xem lần cập nhật cuối` or admin `Ghi nhận kiểm tra`.
- **Use on:** station detail, station card, admin overview.
- **Important:** do not present stale data as current.

## Sensor fault

- **Title:** `Cần kiểm tra cảm biến`
- **Description:** `Cảm biến báo lỗi nên chỉ số hiện tại có thể không đáng tin cậy.`
- **CTA:** admin `Tạo lịch kiểm tra`; public `Gửi báo cáo` if user observes damage.
- **Use on:** metric cards, station detail, admin detail.
- **Important:** separate sensor health from environmental health.

## Permission denied

- **Title:** `Bạn không có quyền xem trang này`
- **Description:** `Trang này dành cho người vận hành hệ thống.`
- **CTA:** `Quay lại trang công khai`
- **Use on:** admin protected routes.
- **Do not:** expose role details or internal policy names.

## Loading

- **Title:** not usually needed.
- **Description:** use only for long operations: `Đang tải dữ liệu trạm...`
- **CTA:** none.
- **Use on:** skeleton screens, chart loading, table loading.
- **Important:** skeleton should match final layout.

## Slow network

- **Title:** `Mạng đang chậm`
- **Description:** `Dữ liệu có thể cập nhật trễ. Thông tin cũ sẽ được ghi rõ thời gian.`
- **CTA:** `Thử lại`
- **Use on:** public station, reports, admin data refresh.
- **Important:** preserve user input.

## Filter has no results

- **Title:** `Không có kết quả phù hợp`
- **Description:** `Không có trạm hoặc báo cáo nào khớp với bộ lọc hiện tại.`
- **CTA:** `Xóa bộ lọc`
- **Use on:** admin tables and report lists.

## Chart no data

- **Title:** `Chưa đủ dữ liệu để vẽ biểu đồ`
- **Description:** `Biểu đồ sẽ hiển thị khi trạm gửi đủ dữ liệu trong khoảng thời gian này.`
- **CTA:** time range selector or `Thử lại`.
- **Use on:** trend charts.
- **Important:** keep chart container height stable.

## Report saved offline

- **Title:** `Báo cáo đã được lưu tạm`
- **Description:** `Báo cáo sẽ tự gửi khi thiết bị có kết nối mạng.`
- **CTA:** `Xem báo cáo đã lưu` if supported.
- **Use on:** report flow.

## Ingestion unavailable

- **Title:** `Chưa thể nhận dữ liệu mới`
- **Description:** `Dịch vụ nhận dữ liệu đang gặp sự cố. Dữ liệu gần nhất vẫn được hiển thị với thời gian cập nhật.`
- **CTA:** admin `Xem trạng thái hệ thống`.
- **Use on:** admin monitoring and runbooks.