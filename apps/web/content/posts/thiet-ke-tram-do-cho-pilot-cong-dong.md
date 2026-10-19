---
title: Thiết kế một trạm đo cho pilot cộng đồng
excerpt: Ràng buộc không chỉ là kỹ thuật. Một trạm đặt trong khu canh tác phải sống được với điện, sóng và thời tiết tại chỗ.
category: Phần cứng
date: 2026-02-05
readingTime: 6 phút đọc
cover: /assets/gallery/gallery-placeholder-04.svg
status: draft
---

Một trạm quan trắc trong phòng thí nghiệm và một trạm đặt ngoài vườn là hai bài
toán khác nhau.

Ngoài hiện trường, thiết bị phải chịu độ ẩm cao, nắng trực tiếp, côn trùng, và
những lần mất điện không báo trước. Nguồn điện không phải lúc nào cũng ổn định.
Sóng di động ở giữa cù lao không mạnh như trong thành phố.

## Những đánh đổi đã chọn

Kiến trúc hiện tại dùng mô hình trạm đo gửi dữ liệu qua một điểm trung chuyển,
thay vì mỗi trạm tự kết nối trực tiếp. Cách này giảm số điểm phải lo về kết nối,
nhưng tạo ra một phụ thuộc mới: nếu điểm trung chuyển gặp sự cố, cả mạng lưới im
lặng.

Đó là một đánh đổi có ý thức cho giai đoạn thí điểm, và là một trong những thứ
cần theo dõi khi hệ thống chạy thật.

## Điều chưa hoàn thiện

Một số chỉ số về tình trạng thiết bị — như điện áp pin hay cường độ sóng — hiện
chưa được firmware ghi nhận và gửi về. Giao diện vẫn giữ chỗ cho chúng và nói rõ
là "chưa được đo", thay vì hiển thị giá trị giả hoặc ẩn đi như thể không tồn tại.

Đây là ghi chép thiết kế trong quá trình phát triển, không phải báo cáo triển
khai đã hoàn tất.
