---
target: All HORIZON web interfaces; official public site plus local admin/login review
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "url:https://horizon.frogsleap.com.vn/"
timestamp: 2026-10-02T11-42-38Z
slug: horizon-frogsleap-com-vn
---
# HORIZON — Critique giao diện toàn bộ ứng dụng

**Target:** toàn bộ các trang giao diện HORIZON; quan sát website production `https://horizon.frogsleap.com.vn/` và đối chiếu source/local preview ở `D:\horizon-project`.

## Design Health Score

| # | Heuristic | Điểm | Nhận xét |
|---|---|---:|---|
| 1 | Hiển thị trạng thái hệ thống | 3/4 | Có freshness, demo/no-data, nhưng “chưa nhận” chưa nói được gateway đang giữ dữ liệu hay không. |
| 2 | Khớp thế giới thực | 3/4 | Tên phép đo, đơn vị, Cồn Hô và vai trò trạm rõ; mã trạm chưa luôn xuất hiện cạnh số liệu. |
| 3 | Kiểm soát và tự do | 3/4 | Có đổi VI/EN, theme, chọn chart, quay lại bước form; video chỉ có affordance điều khiển cơ bản. |
| 4 | Nhất quán và quy ước | 3/4 | Shell, trạng thái và từ điển chia sẻ tốt; Home dài-form đang được ghi chú rõ là chưa có bản dịch tiếng Anh. |
| 5 | Ngăn lỗi | 3/4 | Form có bước, validation và fallback GPS; tệp không hợp lệ có thể cần phản hồi ngay hơn. |
| 6 | Nhận biết thay vì ghi nhớ | 2/4 | Dữ liệu gom theo miền; người dùng phải suy mã trạm từ map/các trang khác. |
| 7 | Linh hoạt và hiệu quả | 3/4 | Chart có chọn chỉ số/thời gian, QR deep-link và report theo bước; chưa có lối tắt trạm ở đầu dashboard. |
| 8 | Thẩm mỹ và tối giản | 3/4 | Bố cục có bản sắc và không dùng gradient vô nghĩa; graticule toàn trang còn hơi lấn. |
| 9 | Nhận biết, chẩn đoán, khôi phục lỗi | 3/4 | Có skeleton, trang offline, error boundary, lỗi gửi report; thiếu ngữ cảnh chẩn đoán trạng thái dữ liệu. |
| 10 | Trợ giúp và tài liệu | 3/4 | Registry công khai và ghi chú nguồn tốt; cần mở nhiều disclosure để biết giá trị nào là tham khảo. |
| **Tổng** | | **29/40** | **Tốt — còn điểm cần tinh chỉnh** |

## Design Specificity Verdict

HORIZON có ngôn ngữ riêng gắn với sổ đo/khảo sát, ảnh hiện trường, nguồn dữ liệu và giới hạn phép đo; không cần thay toàn bộ visual world. Cơ hội tốt nhất là làm mã trạm, trạng thái “chưa có dữ liệu” và quyền hạn của khuyến nghị dễ đọc ngay cạnh số liệu.

Detector chạy trên 70 file trong `apps/web/app` và `apps/web/components`, báo 2 mục:

- `overused-font` — `apps/web/app/globals.css:1168`, Inter. Đây là cảnh báo về tính phổ biến của font, không phải lỗi render; giữ nguyên để không đổi giọng thương hiệu ngoài phạm vi tinh chỉnh.
- `codex-grid-background` — `apps/web/app/globals.css:737`, nền lưới hai trục. Đây là graticule có chủ đích cho ngữ cảnh quan trắc nhưng còn lan qua các trang biên tập; đã giảm tương phản đáng kể, vẫn còn được detector nhận diện.

## Overall Impression

Dashboard có cấu trúc instrument bento, chart và map phù hợp hệ quan trắc. Ở dữ liệu thật hiện quan sát được, chỉ số trạm chưa có dữ liệu; vì vậy yếu tố quan trọng nhất là nói rõ “chưa biết”, không nhuộm xanh an toàn và không gắn nhãn đỏ theo ngưỡng tự đặt.

## What's Working

- Registry trình bày rõ “đang áp dụng” so với “tham khảo — không tạo cảnh báo”; status logic không tự suy ngưỡng độ mặn.
- Giá trị số dùng tabular mono, dấu gạch và nhãn no-data thay vì `null`/`NaN`; bối cảnh thời tiết tách khỏi telemetry trạm.
- Form hiện trường có bước, địa điểm, GPS và nhãn tiếng Anh/Vietnamese tương ứng cho các trang tác vụ.

## Priority Issues

1. **[P1] Không được biến 1.0‰ thành khuyến nghị vận hành.** Registry không có ngưỡng độ mặn hoạt động đã xác nhận và cũng không có luật đóng/mở cống. Nếu tô đỏ hay nói “đóng cống”, người dùng có thể ra quyết định canh tác sai. Giữ trạng thái “chưa có khuyến nghị”, dẫn người dùng tới cơ sở diễn giải. **Command:** `$impeccable harden`.
2. **[P1] Thiếu mã trạm ngay nơi đọc số.** Dashboard gộp số liệu theo miền nhưng trước đây không ghi STATION_01/STATION_02/GATEWAY_01 tại tiêu đề tương ứng; điều này làm yếu khả năng truy nguồn khi đối chiếu tại hiện trường. Hiển thị device code cạnh miền nhưng không thay đổi khóa lưu trữ. **Command:** `$impeccable clarify`.
3. **[P2] Trạng thái trống chưa hướng dẫn cách hiểu.** “Chưa có dữ liệu” trung thực, nhưng không nói liệu trạm chưa kết nối, dữ liệu cũ hay gateway đang giữ gói. Không khẳng định “dữ liệu lưu tại trạm” nếu firmware/backend không cung cấp trạng thái đó. **Command:** `$impeccable harden`.
4. **[P2] Home có hành trình kể chuyện dài.** Hợp với người tìm hiểu dự án, nhưng người chỉ cần số liệu phải chuyển qua Quan trắc. Giữ cấu trúc biên tập và bảo đảm CTA đến dashboard dễ thấy; không cần thay hierarchy để xử lý. **Command:** `$impeccable distill`.

## Persona Red Flags

- **Alex (power user):** cần suy mã trạm khi dashboard nhóm theo miền; không có nút nhảy nhanh tới từng trạm ở đầu trang.
- **Sam (accessibility):** freshness có chữ/icon thay vì màu đơn thuần, nhưng các vùng chart/map và trạng thái ngoài dữ liệu trống cần được kiểm tra tiếp với trình đọc màn hình.
- **Jordan (first-timer):** Home giải thích nơi chốn và thiết bị, nhưng câu chuyện dài; bản tiếng Anh báo rõ nội dung dài-form chưa dịch, tuy nhiên nhiều đoạn vẫn là tiếng Việt theo chủ đích.
- **Riley (field reporter):** form có GPS fallback, nhưng cần thông báo tức thời nếu file media bị từ chối.
- **Casey (mobile):** form theo bước phù hợp; cần kiểm chứng hit-area và chiều dài dashboard trên viewport điện thoại thực.

## Minor Observations

- Chart đang có lưới ngang nét đứt; làm nhẹ đi giúp nét dữ liệu chiếm ưu thế hơn. Ngưỡng 1.0‰ không được vẽ nếu chưa có rule hoạt động.
- Admin yêu cầu đăng nhập. Local `/admin` chuyển về login; không tự động hóa hộp thoại đăng nhập hay dùng thông tin xác thực qua UI.
- Không có khuyến nghị đóng/mở cống trong sản phẩm hiện hành. Không được nhầm salinity ‰ với ECw dS/m, bulk soil EC với ECe, hoặc nguồn ngoài với phép đo tại trạm.
- Giao diện Home ở EN hiển thị thông báo phần long-form chưa dịch; Dashboard và form Báo cáo đã hiển thị EN.

## Questions to Consider

- Khi nào HORIZON có một quy tắc đóng/mở cống được xác thực và đưa vào registry vận hành?
- Backend/gateway có thể cung cấp trạng thái “đang giữ gói tại trạm” đáng tin cậy hay không?
- Dashboard nên ưu tiên lối nhảy trạm hay giữ mô hình domain-first hiện tại?
