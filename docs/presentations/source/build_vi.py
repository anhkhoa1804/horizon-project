#!/usr/bin/env python3
"""HORIZON - Vietnamese YAI 2026 final presentation (10 minutes). Usage: build_vi.py <outdir>
Photo slots: drop real photos at assets/slots/<name>.jpg and rebuild; until then a labelled slot is drawn."""
import sys, os
from hz import *

SL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "slots")
S = {}
TOTAL = 10
def lab(n, dark=True): return progress(n, TOTAL, dark)

def slot(name, left, top, w, h, prompt, dark=True, alt=""):
    """Real photo if supplied, otherwise a clearly marked slot. Never a stand-in photograph."""
    if os.path.exists(f"{SL}/{name}.jpg"):
        return IMG(f"slots/{name}.jpg", alt or prompt, left, top, w, h)
    col = SAND if dark else DUSK_D
    return (f'<div style="position:absolute;left:{left}px;top:{top}px;width:{w}px;height:{h}px;box-sizing:border-box;border:3px dashed {col};'
            f'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:30px">'
            f'<p style="font-size:30px;font-weight:700;color:{col}">Chỗ cho ảnh hiện trường</p>'
            f'<p style="font-size:26px;line-height:1.35;color:{col}">[{prompt}]</p></div>')

PH = lambda t, c=DUSK: f'<span style="color:{c};text-decoration:underline">[{t}]</span>'

# 1 ------------------------------------------------------------ Cồn Hô
S["open"] = section("open", DEEP, WHITE,
    IMG("cover-aerial.jpg", "Cồn Hô nhìn từ trên cao: một cù lao xanh giữa dòng sông nâu", 0, 0, 1920, 1080) +
    '<div style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(to right, rgba(14,34,32,0.9), rgba(14,34,32,0.5) 52%, rgba(14,34,32,0) 88%)"></div>'
    '<div style="position:absolute;left:0;top:700px;width:1920px;height:380px;background:linear-gradient(to bottom, rgba(14,34,32,0), rgba(14,34,32,0.65))"></div>' +
    IMG("horizon-wordmark.png", "Logo HORIZON", 128, 96, 340, 102, "contain") +
    IMG("frogsleap-sticker.png", "Logo Frogsleap", 1640, 84, 152, 140, "contain") +
    H("Hành trình HORIZON<br>ở Cồn Hô", 128, 390, 1300, 140, WHITE, 300, 1.02, build="rise 1", ls=-4) +
    P("Đo nước, đo đất, và lắng nghe người dân.", 128, 740, 1100, 40, "#EDE7D8", 400, build="fade 2") +
    P(f"Báo cáo cuối kỳ YAI 2026 · {PH('Tên nhóm')}", 128, 950, 1100, 26, MUTE_D, 500),
    "Xin chào các bạn. Mình xin bắt đầu từ một nơi, chứ chưa phải từ công nghệ. Đây là Cồn Hô, một cù lao ở Vĩnh Long, giữa dòng sông Mê Công. Trong mười phút tới, mình kể về hành trình HORIZON ở đây: tụi mình đã đo gì, đã học được gì từ người dân, và quan trọng không kém, điều gì tụi mình vẫn chưa chắc chắn. [Nhóm bổ sung: một hai câu về lý do cá nhân của nhóm khi chọn Cồn Hô. Đây là phần chỉ nhóm mới kể được, nên mình để trống thay vì tự viết.]",
    data_section="Cồn Hô và câu hỏi")

# 2 ------------------------------------------------------------ gap
def gridlines():
    v = "".join(f'<div style="position:absolute;left:{x}px;top:0;width:2px;height:1080px;background:rgba(255,255,255,0.75)"></div>' for x in (640, 1280))
    h = "".join(f'<div style="position:absolute;left:0;top:{y}px;width:1920px;height:2px;background:rgba(255,255,255,0.75)"></div>' for y in (360, 720))
    return v + h
S["gap"] = section("gap", SILT, INK,
    IMG("hero.png", "Tranh minh họa Cồn Hô: một cù lao xanh dài giữa hai nhánh sông, có ba trạm quan trắc nhỏ", 0, 0, 1920, 1080) + gridlines() +
    '<div style="position:absolute;left:640px;top:360px;width:640px;height:360px;box-sizing:border-box;border:4px dashed #F28C00"></div>' +
    P("Một ô dự báo", 664, 372, 250, 30, "#FFFFFF", 500, extra="background:rgba(14,34,32,0.72);padding:4px 14px;box-sizing:content-box;text-shadow:0 1px 8px rgba(0,0,0,0.5)") +
    '<div style="position:absolute;left:1030px;top:530px;width:60px;height:60px;box-sizing:border-box;border:5px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 4px #F28C00"></div>' +
    P("Một mảnh vườn", 1106, 538, 270, 30, "#FFFFFF", 500, extra="background:rgba(14,34,32,0.72);padding:4px 14px;box-sizing:content-box;text-shadow:0 1px 8px rgba(0,0,0,0.55)", build="fade 2") +
    H("Dự báo nói về cả vùng.<br>Vườn cần số liệu của riêng mình.", 128, 110, 1500, 88, INK, 300, 1.06, ls=-2, build="rise 1") +
    caption("Tranh minh họa Cồn Hô do dự án cung cấp. Lưới chỉ là sơ đồ.", 128, 940, 1200, False) + lab(2, False),
    "Vấn đề tụi mình thấy rất đơn giản. Dự báo thời tiết hay dự báo sông mô tả cả một ô trên bản đồ, rộng hơn nhiều so với một mảnh vườn. Người trồng cây ở Cồn Hô cần biết nước ở chỗ lấy nước của họ ra sao, đất quanh gốc cây thế nào. Nước mặn thì không đến đều đặn theo mùa, nó đi theo con nước. Vì vậy một người có thể biết hôm nay nước hơi mặn, nhưng khó biết mặn hơn hôm qua bao nhiêu. Cái lưới trên hình chỉ là sơ đồ để các bạn hình dung chênh lệch về quy mô, tụi mình không nói đến một kích thước cụ thể nào.")

# 3 ------------------------------------------------------------ purpose
S["purpose"] = section("purpose", PAPER, INK,
    IMG("people-day.jpg", "Tranh minh họa: vài người đứng cạnh một trạm quan trắc có tấm pin mặt trời trên cù lao, bến thuyền bên trái", 0, 0, 1920, 1080, "cover", "center bottom") +
    H("Công nghệ ở đó để giúp người,<br>không phải thay người.", 128, 110, 1700, 88, INK, 300, 1.06, ls=-2, build="rise 1") +
    P("HORIZON đo nước và đất, rồi trả số liệu về cho người sống ở đây.", 128, 330, 1000, 38, INK, 400, build="fade 2") +
    caption("Tranh minh họa do dự án cung cấp, không phải ảnh chụp.", 128, 940, 1200, False) + lab(3, False),
    "Vì vậy HORIZON có một mục đích khiêm tốn: đặt phép đo cẩn thận ngay gần nơi sản xuất diễn ra, và trả số liệu về cho người sống ở đó. Tụi mình muốn nói rõ một điều. Cảm biến không biết hết mọi thứ. Người dân biết nơi nào bờ đang lở, cái cống nào hay kẹt, mùi nước hôm nay lạ ở đâu. Công nghệ ở đây là để đứng cạnh kiến thức ấy, không phải thay thế nó. Hình này là tranh minh họa của dự án, không phải ảnh chụp thật.")

# 4 ------------------------------------------------------------ deployment
cols = [("sensor-water-ec.jpg", "Trạm Nước", "Mực nước, EC, nhiệt độ, độ mặn"),
        ("sensor-soil-ph.jpg", "Trạm Đất", "Độ ẩm, EC, pH, nhiệt độ đất, không khí"),
        ("board-gateway.jpg", "Gateway", "Nhận sóng LoRa, gửi lên mạng di động")]
body = ""
for i, (im, t, d) in enumerate(cols):
    x = 128 + i * 560
    body += IMG(im, f"Ảnh phần cứng: {t}", x, 250, 520, 560, "cover", "center", "box-shadow:0 20px 50px rgba(0,0,0,0.4)", build=f"fade {i+1}")
    body += P(t, x, 830, 520, 40, WHITE, 500, build=f"fade {i+1}")
    body += P(d, x, 880, 520, 26, MUTE_D, 400, 1.3, build=f"fade {i+1}")
S["field"] = section("field", RIVER, WHITE,
    H("Ba nút trên một cù lao.", 128, 100, 1500, 92, WHITE, 200, 1.04, ls=-3, build="rise 1") + body +
    caption(f"Phần cứng nhóm tự làm, chụp trên bàn thử. {PH('Thay bằng ảnh lắp đặt tại hiện trường khi có', SAND)}", 128, 950, 1500, True) + lab(4),
    "Mạng thí điểm có đúng ba nút. Trạm Nước đo mực nước, độ dẫn điện, nhiệt độ và độ mặn ở mép sông. Trạm Đất đo độ ẩm, độ dẫn điện, pH và nhiệt độ của đất, cộng thêm nhiệt độ và độ ẩm không khí. Nút thứ ba là gateway: nó không đo gì cả, chỉ nhận sóng vô tuyến từ hai trạm rồi gửi lên mạng di động. Ba ảnh trên màn hình là phần cứng nhóm tự làm, chụp trên bàn thử, chưa phải ảnh lắp đặt ngoài hiện trường. [Nhóm bổ sung: ảnh lắp đặt thật, ngày lắp, ai tham gia lắp. Khi có ảnh, thay vào đây và nói về nó, vì ảnh hiện trường kể chuyện tốt hơn mọi sơ đồ.]")

# 5 ------------------------------------------------------------ numbers
S["numbers"] = section("numbers", DEEP, WHITE,
    IMG("people-night.jpg", "Tranh minh họa Cồn Hô ban đêm, trăng sáng, trạm quan trắc có đèn", 0, 0, 1920, 1080, "cover", "center bottom") +
    '<div style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(to right, rgba(14,34,32,0.9), rgba(14,34,32,0.55) 60%, rgba(14,34,32,0.3))"></div>' +
    H("6.465", 120, 180, 1400, 330, WHITE, 200, 1.0, ls=-10, build="rise 1") +
    P("lượt đo đã lưu từ Trạm Nước", 128, 560, 1200, 56, WHITE, 400, build="fade 2") +
    P("Từ 25/9 đến 21/10/2026, khoảng 2,5 phút một lần.", 128, 640, 1100, 34, MUTE_D, 400, build="fade 2") +
    P("3 nút · 10 đại lượng được thiết kế để đo", 128, 860, 1100, 30, SAND, 500) +
    caption("Đếm chỉ-đọc trên dữ liệu thật ngày 21/10/2026. Cho thấy số liệu về đều, chưa chứng minh số liệu đúng.", 128, 940, 1500, True) + lab(5),
    "Đây là con số tụi mình tự tin nhất: sáu nghìn bốn trăm sáu mươi lăm lượt đo của Trạm Nước đã được lưu từ ngày hai mươi lăm tháng chín đến ngày hai mươi mốt tháng mười năm hai nghìn không trăm hai mươi sáu, cứ khoảng hai phút rưỡi một lần. Tụi mình đếm bằng quyền chỉ đọc, ngày hai mươi mốt tháng mười. Hãy nghe cho kỹ vế sau: con số này cho thấy số liệu đang về đều đặn, chứ chưa chứng minh số liệu chính xác. Muốn chứng minh độ chính xác, tụi mình cần hiệu chuẩn với thiết bị chuẩn, và việc đó chưa làm. Dòng nhỏ bên dưới, ba nút và mười đại lượng, là những gì hệ thống được thiết kế để đo. Trạm Đất hiện chưa lưu được lượt đo nào, tụi mình sẽ nói ở slide sau.")

# 6 ------------------------------------------------------------ visits
vx = [128, 688, 1248]
vs = ""
for i, x in enumerate(vx, 1):
    vs += slot(f"visit{i}", x, 270, 544, 400, f"Ảnh lần {i}", True)
    vs += P(f"Lần {i} · {PH('ngày')}", x, 700, 544, 34, WHITE, 500)
    vs += P(PH("Việc đã làm và điều học được", SAND), x, 750, 544, 28, MUTE_D, 400, 1.35)
S["visits"] = section("visits", RIVER, WHITE,
    H("Ba lần quay lại hiện trường.", 128, 100, 1600, 92, WHITE, 200, 1.04, ls=-3, build="rise 1") +
    P(f"Khó khăn thực tế: {PH('Nhóm kể 2–3 khó khăn thật, ví dụ về điện, sóng, thời tiết, lắp đặt', SAND)}", 128, 215, 1600, 30, MUTE_D, 400) + vs + lab(6),
    "Slide này là của nhóm. Tụi mình đã quay lại Cồn Hô ba lần, và mỗi lần đều có những điều không nằm trong kế hoạch. [Nhóm bổ sung, theo thứ tự: lần một diễn ra khi nào, làm gì, gặp khó khăn gì; lần hai; lần ba. Mỗi lần kèm một tấm ảnh thật.] Mình cố ý không viết thay, vì những chuyện như vậy chỉ đúng khi do chính các bạn kể, bằng đúng những gì đã xảy ra. Gợi ý cách kể: mỗi lần một ý, một khó khăn, một điều học được, rồi nối sang lần sau. Tránh liệt kê kỹ thuật, hãy kể bằng con người và địa điểm.")

# 7 ------------------------------------------------------------ service learning
S["service"] = section("service", PAPER, INK,
    slot("community", 128, 128, 1000, 760, "Ảnh làm việc cùng người dân hoặc sinh hoạt cộng đồng", False) +
    H("Cùng làm với người dân.", 1220, 130, 580, 76, INK, 300, 1.06, ls=-2, build="rise 1") +
    P("Chọn trạm gần nhất. Kể điều mình thấy. Gửi kèm ảnh hoặc video. Không cần tài khoản.", 1220, 400, 560, 32, INK, 400, build="fade 2") +
    P(f"Người dân đã tham gia: {PH('số buổi / số hộ do nhóm bổ sung')}", 1220, 680, 560, 28, DUSK_D, 500, build="fade 3") +
    caption("Trang ghi nhận hiện trường đã được xây dựng và kiểm thử. Chưa đo lường mức độ sử dụng.", 1220, 810, 560, False) + lab(7, False),
    "Phần này nói về Service-Learning, tức là học bằng cách phục vụ cộng đồng. [Nhóm bổ sung: tụi mình đã làm việc với ai ở Cồn Hô, vào những buổi nào, người dân nói gì, tụi mình đổi cách làm ra sao. Mình không viết lời của người dân ở đây, vì chỉ trích dẫn khi có thật.] Về phía sản phẩm, tụi mình xây một trang ghi nhận hiện trường rất đơn giản: không cần tài khoản, chọn trạm gần nhất, kể điều mình thấy, đính kèm ảnh hoặc video. Trang này đã được xây dựng và kiểm thử, nhưng tụi mình chưa đo được có bao nhiêu người dùng nó, nên không nói gì về mức độ sử dụng. Điều tụi mình muốn các bạn nhớ: cảm biến cho số liệu, người dân cho ý nghĩa của số liệu.")

# 8 ------------------------------------------------------------ results & limits
def blk(title, lines, bar_style):
    t = "".join(f'<p style="font-size:34px;line-height:1.35;margin-top:10px">{l}</p>' for l in lines)
    return f'<div style="{bar_style};padding-left:30px"><p style="font-size:38px;font-weight:700;line-height:1.2">{title}</p>{t}</div>'
S["limits"] = section("limits", SILT, INK,
    H("Đã làm được gì,<br>và chưa chứng minh gì.", 128, 110, 1000, 80, INK, 200, 1.06, ls=-2, build="rise 1") +
    A(128, 400, 900, blk("Đã làm được", ["Số liệu từ cù lao lên được một trang công khai.", "Dữ liệu thiếu hiện là “chưa có”, không bao giờ là 0."], f"border-left:6px solid {INK}"), build="fade 2") +
    A(128, 640, 900, blk("Chưa chứng minh", ["Cảm biến chưa được hiệu chuẩn với thiết bị chuẩn.", "Chưa có ngưỡng nào được kiểm chứng tại Cồn Hô.", "Trạm Đất chưa lưu được số liệu."], f"border-left:6px dashed {DUSK_D}"), build="fade 3") +
    IMG("sensor-water-ec.jpg", "Ảnh đầu dò đo độ dẫn điện và nhiệt độ nước, dây cuộn tròn", 1120, 130, 672, 756, "cover", "center", "box-shadow:0 24px 60px rgba(20,48,46,0.25)") +
    caption("Đầu dò nước, ảnh chụp trên bàn thử.", 1120, 900, 672, False) + lab(8, False),
    "Đây là phần tụi mình muốn nói thật nhất. Điều làm được: số liệu từ cù lao đã lên được một trang công khai, và trang đó có một nguyên tắc là dữ liệu thiếu thì hiện là chưa có dữ liệu, không bao giờ hiện thành số không. Điều chưa chứng minh: cảm biến chưa được hiệu chuẩn so với thiết bị chuẩn, chưa có ngưỡng cảnh báo nào được kiểm chứng riêng cho Cồn Hô, và Trạm Đất chưa lưu được số liệu. Tụi mình cũng thấy có những đoạn độ mặn bằng không kéo dài ở Trạm Nước, và chưa biết đó là nước thật sự không mặn hay đầu dò đang đo sai. Tụi mình tìm ra điều này bằng cách tự kiểm tra hệ thống của mình, và tụi mình thà nói với các bạn còn hơn để các bạn tự phát hiện. Chi tiết nằm ở phụ lục.")

# 9 ------------------------------------------------------------ sustainability
def srow(w, t):
    return (f'<div style="border-top:1px solid rgba(248,244,234,0.25);padding:22px 0 18px"><p style="font-size:52px;font-weight:200;line-height:1.1">{w}</p>'
            f'<p style="font-size:30px;line-height:1.35;color:{MUTE_D};margin-top:8px">{t}</p></div>')
S["sustain"] = section("sustain", DEEP, WHITE,
    IMG("sunset-tall.jpg", "Dòng sông cạnh Cồn Hô lúc hoàng hôn, trời cam trên mặt nước tối", 1180, 0, 740, 1080) +
    '<div style="position:absolute;left:1180px;top:0;width:300px;height:1080px;background:linear-gradient(to right, #0E2220, rgba(14,34,32,0))"></div>' +
    H("Để chạy được lâu dài.", 128, 110, 1000, 92, WHITE, 200, 1.04, ls=-3, build="rise 1") +
    A(128, 330, 940, srow("Bảo trì", "Lịch và nhật ký cho từng trạm.") + srow("Hiệu chuẩn", "Đối chiếu thiết bị chuẩn, có chuyên gia xem lại.") +
      srow("Người tiếp nhận", PH("Ai vận hành sau khi dự án kết thúc")) + '<div style="border-top:1px solid rgba(248,244,234,0.25)"></div>', build="fade 2") + lab(9),
    "Một hệ thống đo chỉ có ích nếu nó còn chạy sau khi dự án kết thúc. Tụi mình nghĩ tới ba việc. Một là bảo trì: mỗi trạm có lịch và nhật ký riêng. Hai là hiệu chuẩn: đối chiếu với thiết bị chuẩn và có chuyên gia về nông học, thủy văn xem lại trước khi công bố bất kỳ ngưỡng nào. Ba, và đây là câu hỏi mở: ai sẽ tiếp nhận và vận hành sau khi nhóm rời đi, và chi phí mỗi năm là bao nhiêu. [Nhóm bổ sung nếu đã trao đổi với địa phương hay đơn vị nào.] Tụi mình chưa có câu trả lời đã được xác nhận, nên để trống trên slide. Ảnh bên phải là dòng sông cạnh Cồn Hô lúc hoàng hôn.")

# 10 ----------------------------------------------------------- what remains
S["remains"] = section("remains", DEEP, WHITE,
    IMG("people-night.jpg", "Tranh minh họa Cồn Hô ban đêm: vài người đứng cạnh trạm quan trắc dưới trăng", 0, 0, 1920, 1080, "cover", "center bottom") +
    '<div style="position:absolute;left:0;top:0;width:1920px;height:560px;background:linear-gradient(to bottom, rgba(14,34,32,0.55), rgba(14,34,32,0))"></div>' +
    H("Điều còn lại khi nhóm rời đi.", 128, 100, 1500, 92, WHITE, 200, 1.04, ls=-3, build="rise 1") +
    P("Một trang số liệu công khai.<br>Một kênh để người dân báo cáo.<br>Một bản ghi nói rõ điều đã và chưa được kiểm chứng.", 128, 260, 1100, 38, "#F1ECDD", 400, 1.5, build="fade 2") +
    IMG("horizon-wordmark.png", "Logo HORIZON", 128, 905, 200, 60, "contain") + P("Cảm ơn các bạn đã lắng nghe.", 360, 912, 900, 30, WHITE, 500) +
    caption("Tranh minh họa do dự án cung cấp.", 1292, 1000, 500, True, "right") + lab(10),
    "Để kết lại, câu hỏi mà tụi mình muốn để lại là: khi nhóm rời đi, còn lại gì? Còn lại một trang số liệu công khai, nếu có người tiếp tục duy trì nó. Còn lại một kênh để người dân báo cáo điều họ thấy. Và còn lại một bản ghi nói rõ điều gì đã được kiểm chứng, điều gì chưa, để người đến sau không phải đoán. Cảm biến có thể hỏng, nhưng quan hệ giữa tụi mình và người dân Cồn Hô, và thói quen nói thật về giới hạn của số liệu, mới là thứ tụi mình mong ở lại. [Nhóm bổ sung một câu cảm ơn đích danh, nếu muốn.] Cảm ơn các bạn đã lắng nghe.")

# appendix --------------------------------------------------------------
def arow(lead, txt):
    return (f'<div style="display:flex;gap:36px;border-top:1px solid rgba(20,48,46,0.25);padding:16px 0"><p style="width:430px;font-size:30px;font-weight:700;line-height:1.25">{lead}</p>'
            f'<p style="width:900px;font-size:30px;line-height:1.35">{txt}</p></div>')
S["appx"] = section("appx", SILT, INK,
    P("Phụ lục", 128, 100, 400, 26, MUTE_L, 500) + H("Nguồn của các con số", 128, 150, 1400, 80, INK, 200, 1.04, ls=-2) +
    A(128, 290, 1664, arow("6.465 lượt đo", "Đếm chỉ-đọc, Trạm Nước, từ 25/9/2026, ngày 21/10/2026. Cho thấy số liệu về, không chứng minh độ chính xác.") +
      arow("Khoảng 2,5 phút một lần", "Quan sát trên các dòng gần nhất của Trạm Nước. Chưa có bản ghi mạng của gateway.") +
      arow("3 nút · 10 đại lượng", "Theo thiết kế: Trạm Nước 4, Trạm Đất 4, không khí 2. Trạm Đất chưa lưu số liệu nên chưa quan sát thực tế.") +
      arow("Độ mặn bằng 0 kéo dài", "322 trong 1.000 lượt đo gần nhất của Trạm Nước. Chưa rõ nguyên nhân; cần truy vấn quản trị để phân biệt.") +
      arow("Kiểm thử phần mềm", "356 bài kiểm thử tự động đạt (21/10/2026). Đây là kết quả phần mềm, không phải kết quả hiện trường.")) +
    P("Chỗ có dấu ngoặc vuông là nội dung nhóm cần bổ sung. Chúng tôi không tự điền.", 128, 960, 1600, 26, MUTE_L, 500),
    "Phụ lục: nguồn của từng con số trong bài. Mọi số liệu đều có ngày lấy và loại bằng chứng. Các chỗ có dấu ngoặc vuông là phần nhóm cần tự bổ sung.")

order = ["open", "gap", "purpose", "field", "numbers", "visits", "service", "limits", "sustain", "remains", "appx"]
if __name__ == "__main__":
    write(sys.argv[1], S, order, "HORIZON YAI 2026 - Báo cáo cuối kỳ",
          {"s1": {"description": "Cồn Hô và câu hỏi", "start": "open"},
           "s2": {"description": "Hiện trường và con người", "start": "field"},
           "s3": {"description": "Kết quả, giới hạn và điều còn lại", "start": "limits"}})
