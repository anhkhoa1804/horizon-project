# Copywriting Guide

## Purpose

Eco-Sense copy should help people understand environmental state quickly. The default language for farmer-facing UI should be Vietnamese. English may be used for demos, judges, and technical/admin contexts, but it must remain plain.

## Voice

The voice is:

- calm,
- direct,
- respectful,
- practical,
- precise,
- non-alarming.

The voice is not:

- dramatic,
- playful,
- technical for its own sake,
- corporate jargon,
- developer-centric,
- blameful.

## Vietnamese terminology

| Concept | Preferred Vietnamese | Avoid |
|---------|----------------------|-------|
| Salinity | `Độ mặn` | `EC`, `chỉ số telemetry`, `salinity reading` |
| Water level | `Mực nước` | `ultrasonic value` |
| Stable | `Ổn định` | `OK` alone |
| Watch | `Cần chú ý` | `Warning`, `anomaly` |
| High risk | `Nguy cơ cao` | `Fatal`, `critical failure` |
| Offline | `Mất kết nối` | `Device dead`, `network fatal` |
| No data | `Chưa có dữ liệu` | `No records found` |
| Sensor fault | `Cần kiểm tra cảm biến` | `Sensor exception` |
| Last updated | `Cập nhật lần cuối` | `Timestamp` |
| Report | `Gửi báo cáo` | `Submit ticket` |
| Threshold | `Ngưỡng an toàn` | `Config limit` |
| Battery | `Pin` | `Voltage telemetry` |
| Signal | `Tín hiệu` | `RSSI` unless admin detail |

## English terminology

| Concept | Preferred English | Avoid |
|---------|-------------------|-------|
| Stable | `Stable` | `Normal state achieved` |
| Watch | `Watch` | `Anomaly` |
| Risk | `High risk` | `Fatal`, `Critical` unless legally required |
| Offline | `Offline` | `Dead` |
| No data | `No data yet` | `No records found` |
| Sensor fault | `Sensor needs checking` | `Telemetry exception` |
| Last updated | `Last updated` | `Timestamp` |
| Report | `Submit report` | `Create ticket` |

## Status wording

### Healthy

Vietnamese:

- `Nước đang ổn định.`
- `Các chỉ số nằm trong ngưỡng an toàn.`
- `Cảm biến hoạt động bình thường.`

English:

- `Water is stable.`
- `Readings are within the safe range.`
- `Sensors are working normally.`

### Watch

Vietnamese:

- `Cần chú ý.`
- `Độ mặn đang gần ngưỡng an toàn.`
- `Theo dõi thêm trong vài giờ tới.`

English:

- `Watch this station.`
- `Salinity is near the safe limit.`
- `Monitor changes over the next few hours.`

### Risk

Vietnamese:

- `Nguy cơ cao.`
- `Độ mặn vượt ngưỡng an toàn.`
- `Nên kiểm tra ao và nguồn nước.`

English:

- `High risk.`
- `Salinity is above the safe range.`
- `Check the pond and water source.`

### Offline

Vietnamese:

- `Trạm đang mất kết nối.`
- `Dữ liệu mới nhất được ghi nhận lúc {time}.`
- `Không dùng dữ liệu cũ để đánh giá tình trạng hiện tại.`

English:

- `Station is offline.`
- `Latest data was received at {time}.`
- `Do not use old data as the current condition.`

### Sensor fault

Vietnamese:

- `Cần kiểm tra cảm biến.`
- `Chỉ số hiện tại có thể không đáng tin cậy.`
- `Vui lòng kiểm tra đầu dò hoặc vị trí lắp đặt.`

English:

- `Sensor needs checking.`
- `Current readings may be unreliable.`
- `Check the probe or installation position.`

## Error wording

| Situation | Vietnamese | English |
|-----------|------------|---------|
| Generic failure | `Chưa thể tải dữ liệu. Vui lòng thử lại.` | `Data could not be loaded. Please try again.` |
| Slow network | `Mạng đang chậm. Dữ liệu có thể cập nhật trễ.` | `Network is slow. Data may update late.` |
| Offline submit | `Báo cáo đã lưu trên thiết bị và sẽ gửi khi có mạng.` | `Report saved on this device and will sync when online.` |
| Permission denied | `Bạn không có quyền xem trang này.` | `You do not have access to this page.` |
| Invalid form | `Vui lòng kiểm tra các mục được đánh dấu.` | `Please check the highlighted fields.` |
| Device rejected | `Thiết bị chưa được đăng ký hoặc đã bị tạm dừng.` | `Device is not registered or is inactive.` |

## CTA rules

Use verbs. Be specific.

Good Vietnamese CTAs:

- `Xem trạm`
- `Gửi báo cáo`
- `Thử lại`
- `Lưu ngưỡng`
- `Xem chi tiết`
- `Đánh dấu đã xử lý`

Avoid:

- `OK`
- `Submit`
- `Click here`
- `Proceed`
- `Manage`

## Alert copy formula

Use this structure:

```text
{State}. {Reason}. {Recommended next step}.
```

Examples:

- `Cần chú ý. Độ mặn đang gần ngưỡng an toàn. Theo dõi thêm trong vài giờ tới.`
- `Mất kết nối. Trạm chưa gửi dữ liệu trong 45 phút. Kiểm tra nguồn điện hoặc tín hiệu.`

## Empty state copy formula

Use this structure:

```text
{What is missing}. {Why it may be missing}. {What can be done next}.
```

Examples:

- `Chưa có dữ liệu đo. Trạm có thể chưa gửi bản tin đầu tiên. Thử tải lại sau vài phút.`
- `Chưa có báo cáo. Khi người dân gửi báo cáo, nội dung sẽ xuất hiện tại đây.`

## Words to avoid

Avoid these in public UI:

- `telemetry`
- `anomaly`
- `fatal`
- `critical`
- `exception`
- `payload`
- `database`
- `row`
- `query`
- `RSSI` unless in admin detail
- `HMAC` unless in technical docs

Admin UI may use technical terms only when they help operators act.