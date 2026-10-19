---
title: Từ cảm biến đến một quyết định ngoài hiện trường
excerpt: Khoảng cách khó nhất trong một hệ quan trắc không nằm ở phần cứng, mà ở đoạn giữa con số và hành động của người đọc nó.
category: Thiết kế sản phẩm
date: 2026-02-19
readingTime: 5 phút đọc
cover: /assets/gallery/gallery-placeholder-03.svg
status: draft
---

Một cảm biến gửi về `1.24`. Câu hỏi thật sự bắt đầu từ đó.

Con số này cao hay thấp? So với hôm qua thì sao? Nó có nghĩa gì với vườn bưởi
cách trạm hai trăm mét? Và quan trọng nhất: bây giờ nên làm gì?

Phần lớn công sức thiết kế của HORIZON nằm ở đoạn này, không phải ở việc lấy
được số đo.

## Ba lớp cần có

Một giá trị đơn lẻ hiếm khi đủ. Giao diện hiện tại được xây quanh ba lớp:

1. **Giá trị** — con số như hệ thống ghi nhận.
2. **Trạng thái** — số liệu này mới hay cũ, thiết bị còn kết nối không.
3. **Nguồn gốc** — đây là quan trắc thật, dữ liệu minh họa, hay ngưỡng tham
   chiếu.

Lớp thứ ba thường bị bỏ qua trong các bảng điều khiển thông thường, nhưng lại là
lớp quyết định mức độ tin cậy. Một người sẽ hành động khác nhau tùy vào việc con
số trước mặt là đo trực tiếp hay ước tính.

## Khi không có dữ liệu

Trạng thái "chưa có dữ liệu" cũng là một thông tin. Thiết kế hiện tại chọn hiển
thị rõ điều đó thay vì để trống hoặc điền giá trị thay thế — người đọc cần phân
biệt được "hệ thống đo và thấy ổn" với "hệ thống chưa đo được".
