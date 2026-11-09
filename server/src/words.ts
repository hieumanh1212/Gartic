// Bộ từ mặc định. Có thể thêm/bớt thoải mái — mỗi từ nên dễ vẽ.
const RAW = `
con mèo, con chó, con gà, con vịt, con heo, con bò, con trâu, con ngựa, con dê, con cừu,
con voi, con hổ, con sư tử, con khỉ, con gấu, con thỏ, con chuột, con rắn, con ếch, con rùa,
con cá, cá mập, cá voi, con mực, con bạch tuộc, con cua, con tôm, con ốc, con sứa, sao biển,
con chim, chim cánh cụt, con cú, con đại bàng, con vẹt, con công, con hươu, hươu cao cổ, ngựa vằn, con lạc đà,
con kangaroo, con gấu trúc, con cáo, con sói, con nhím, con dơi, con ong, con bướm, con kiến, con nhện,
con muỗi, con ruồi, con gián, con sâu, con ốc sên, con chuồn chuồn, con khủng long, con rồng, kỳ lân, con cá sấu,
quả táo, quả chuối, quả cam, quả nho, quả dưa hấu, quả dứa, quả xoài, quả dừa, quả dâu tây, quả chanh,
quả bơ, quả đào, quả lê, quả sầu riêng, quả măng cụt, quả thanh long, quả ớt, củ cà rốt, củ khoai tây, cà chua,
bắp cải, cây nấm, quả trứng, bánh mì, bánh chưng, bánh xèo, bánh kem, bánh pizza, bánh hamburger, xúc xích,
phở, bún chả, cơm tấm, nem rán, mì tôm, kem ốc quế, kẹo mút, sô cô la, bỏng ngô, khoai tây chiên,
cà phê, trà sữa, nước cam, ly sữa, chai nước, hộp sữa, bát cơm, đôi đũa, cái thìa, cái nĩa,
con dao, cái nồi, cái chảo, ấm nước, cái cốc, cái đĩa, tủ lạnh, lò vi sóng, nồi cơm điện, máy giặt,
cái ghế, cái bàn, cái giường, cái gối, cái chăn, tủ quần áo, cái gương, đồng hồ, đồng hồ báo thức, bóng đèn,
cây nến, cái quạt, điều hòa, ti vi, điện thoại, máy tính, bàn phím, con chuột máy tính, tai nghe, máy ảnh,
cái loa, cái micro, điều khiển, pin, ổ cắm điện, chìa khóa, ổ khóa, cái cửa, cửa sổ, cầu thang,
cái ô, cái mũ, mũ bảo hiểm, kính mắt, đôi giày, đôi dép, đôi tất, cái áo, quần bò, váy,
cà vạt, găng tay, khăn quàng, cái ba lô, cái ví, nhẫn, vòng cổ, đồng hồ đeo tay, cái lược, bàn chải đánh răng,
kem đánh răng, xà phòng, khăn tắm, bồn tắm, vòi hoa sen, bồn cầu, cái kéo, cái bút, bút chì, cục tẩy,
quyển sách, quyển vở, cái thước, cặp sách, bảng đen, phấn, quả địa cầu, kính lúp, kính hiển vi, nam châm,
cái búa, cái đinh, cái cưa, cái thang, cái xẻng, cái xô, cái chổi, bình tưới, cái cân, cái kìm,
xe đạp, xe máy, ô tô, xe buýt, xe tải, xe cứu hỏa, xe cứu thương, xe cảnh sát, tàu hỏa, máy bay,
trực thăng, tàu thủy, thuyền buồm, tàu ngầm, tên lửa, khinh khí cầu, xe đẩy, ván trượt, xích lô, đèn giao thông,
mặt trời, mặt trăng, ngôi sao, đám mây, cầu vồng, tia sét, cơn mưa, bông tuyết, người tuyết, núi lửa,
ngọn núi, dòng sông, thác nước, hòn đảo, bãi biển, sa mạc, hang động, rừng rậm, cái cây, bông hoa,
hoa hồng, hoa sen, hoa hướng dương, cây xương rồng, cây dừa, chiếc lá, cỏ, đá, ngọn lửa, cái giếng,
ngôi nhà, trường học, bệnh viện, nhà thờ, lâu đài, cây cầu, tháp, cột điện, công viên, sân bóng,
bể bơi, siêu thị, chợ, nhà hàng, rạp chiếu phim, thư viện, sở thú, nghĩa trang, ngọn hải đăng, kim tự tháp,
bác sĩ, y tá, giáo viên, cảnh sát, lính cứu hỏa, đầu bếp, ca sĩ, nông dân, phi hành gia, phi công,
thợ mộc, thợ cắt tóc, họa sĩ, ảo thuật gia, chú hề, cướp biển, ninja, siêu nhân, công chúa, phù thủy,
ma cà rồng, xác ướp, bộ xương, con ma, người ngoài hành tinh, đĩa bay, rô bốt, thiên thần, ông già noel, cây thông noel,
quả bóng đá, bóng rổ, bóng chuyền, cầu lông, bóng bàn, quần vợt, đánh golf, bơi lội, chạy bộ, nhảy dây,
đá cầu, cờ vua, con diều, xích đu, cầu trượt, đu quay, con quay, búp bê, gấu bông, trò chơi điện tử,
đàn ghi ta, đàn piano, cái trống, kèn trumpet, đàn violin, sáo, nốt nhạc, máy hát, chuông gió, cái chuông,
con mắt, cái mũi, cái miệng, cái tai, bàn tay, bàn chân, trái tim, bộ não, cái răng, mái tóc,
râu, móng tay, đầu gối, khuôn mặt cười, nước mắt, ngủ gật, ngáp, hắt hơi, đánh răng, rửa tay,
nấu ăn, câu cá, cắm trại, leo núi, chụp ảnh, đọc sách, ca hát, nhảy múa, vẽ tranh, trồng cây,
bao lì xì, đèn lồng, pháo hoa, bánh trung thu, mâm ngũ quả, cành đào, cây quất, nón lá, áo dài, chùa một cột,
quà tặng, bóng bay, vương miện, thanh kiếm, cái khiên, cung tên, kho báu, bản đồ, la bàn, chiếc nhẫn kim cương,
lá thư, phong bì, con tem, hộp quà, tiền xu, thẻ ngân hàng, cái két sắt, máy bán hàng, xe hàng, giỏ hàng,
cái lều, lửa trại, đèn pin, ống nhòm, cái võng, cái thuyền thúng, con trâu cày ruộng, ruộng bậc thang, cánh đồng lúa, bù nhìn
`;

export const WORDS: string[] = Array.from(
  new Set(
    RAW.split(',')
      .map((w) => w.trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  ),
);
