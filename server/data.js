'use strict';
// Dữ liệu game: bàn cờ, giai đoạn, thẻ, câu hỏi. Nội dung bám giáo trình Kinh tế chính trị Mác – Lênin, Chương 4 (MLN122).

const TEAM_DEFS = [
  { name: 'Rồng Đỏ', color: '#D2402B' },
  { name: 'Sao Xanh', color: '#1F5FBF' },
  { name: 'Kim Vàng', color: '#D69A0B' },
  { name: 'Lam Tím', color: '#7A3FB0' },
];

// Nhóm ngành (màu băng trên ô)
const GROUPS = {
  A: { name: 'Nông – thủy sản', color: '#8B5E3C' },
  B: { name: 'Dệt may – Bán lẻ', color: '#D86BA0' },
  C: { name: 'Vật liệu xây dựng', color: '#7C8B96' },
  D: { name: 'Năng lượng – Hóa chất', color: '#E07B1A' },
  E: { name: 'Công nghiệp chế tạo', color: '#2E8B57' },
  F: { name: 'Công nghệ – Viễn thông', color: '#2F6FDE' },
  BANK: { name: 'Tư bản tài chính', color: '#A68A2B' },
  STATE: { name: 'Độc quyền nhà nước', color: '#5B4B8A' },
};

const p = (g, name, price) => ({ type: 'prop', group: g, name, price, rent: Math.round((price * 0.18) / 5) * 5 });
const bank = (name) => ({ type: 'bank', group: 'BANK', name, price: 160, rent: 40 });
const state = (name) => ({ type: 'state', group: 'STATE', name, fee: 30 });

// 36 ô, đi theo chiều kim đồng hồ. Góc: 0, 9, 18, 27.
const TILES = [
  { type: 'start', name: 'Xuất phát', short: 'Nhận lợi nhuận bình quân +200' }, //0
  p('A', 'Lúa gạo', 60), //1
  p('A', 'Cà phê – Hồ tiêu', 60), //2
  { type: 'card', name: 'Thời cuộc' }, //3
  p('A', 'Thủy sản', 80), //4
  state('Điện lực quốc gia'), //5
  p('B', 'Dệt may', 100), //6
  p('B', 'Da giày', 100), //7
  { type: 'fdi', name: 'Đầu tư trực tiếp (FDI)', minPhase: 2 }, //8
  { type: 'cartel', name: 'Hội nghị Cartel', minPhase: 2 }, //9
  p('B', 'Thời trang – Bán lẻ', 120), //10
  bank('Ngân hàng Đại Phát'), //11
  p('C', 'Xi măng', 120), //12
  { type: 'card', name: 'Thời cuộc' }, //13
  p('C', 'Thép', 140), //14
  p('C', 'Vật liệu xây dựng', 140), //15
  state('Đường sắt – Cảng biển'), //16
  { type: 'rd', name: 'Viện nghiên cứu KHKT' }, //17
  { type: 'regulate', name: 'Nhà nước điều tiết', minPhase: 2 }, //18
  p('D', 'Khai khoáng', 160), //19
  p('D', 'Dầu khí', 180), //20
  { type: 'crisis', name: 'Khủng hoảng' }, //21
  p('D', 'Hóa chất – Phân bón', 160), //22
  bank('Ngân hàng Thịnh Vượng'), //23
  p('E', 'Ô tô', 200), //24
  p('E', 'Điện tử – Bán dẫn', 200), //25
  { type: 'fii', name: 'Đầu tư gián tiếp (FII)', minPhase: 2 }, //26
  { type: 'lobby', name: 'Vận động hành lang', minPhase: 3 }, //27
  p('E', 'Cơ khí chế tạo', 180), //28
  { type: 'card', name: 'Thời cuộc' }, //29
  p('F', 'Viễn thông', 220), //30
  p('F', 'Nền tảng số', 240), //31
  state('Cấp nước – Thủy điện'), //32
  bank('Ngân hàng Quốc Tế'), //33
  p('F', 'Điện toán đám mây – AI', 240), //34
  { type: 'card', name: 'Thời cuộc' }, //35
];

const START_CASH = 900;
const SALARY = 200;
const FDI_COST = 200;
const FDI_YIELD = 60;
const FII_COST = 100;
const FII_RETURNS = [0, 60, 120, 160, 200, 260];
const RD_COST = 100;
const LOBBY_COST = 80;
const BANK_RENT = 40;
const MULT = {
  1: { 1: 1, 2: 1, 3: 1 },
  2: { 1: 1, 2: 1.5, 3: 2.5 },
  3: { 1: 1, 2: 2, 3: 4 },
};

const PHASES = {
  1: {
    name: 'Tự do cạnh tranh',
    lead: 'Nhiều doanh nghiệp nhỏ cạnh tranh tự do.',
    body: 'Chưa ai đủ mạnh để chi phối thị trường: tiền thuê giữ nguyên. Hãy mua ngành, tích lũy vốn. Đây là điểm xuất phát của quá trình tích tụ.',
    unlock: ['Mua ngành và thu tiền thuê', 'Viện KHKT nâng năng suất'],
    ref: 'Lý thuyết: tự do cạnh tranh → tích tụ và tập trung sản xuất → độc quyền',
  },
  2: {
    name: 'Tích tụ và tập trung',
    lead: 'Doanh nghiệp lớn nuốt doanh nghiệp nhỏ.',
    body: 'Ai gom 2/3 hoặc 3/3 ngành trong một nhóm sẽ thu tiền thuê cao hơn (liên kết ngang). Ai đủ tiền có thể thôn tính ngành của đội khác. Cartel, xuất khẩu tư bản (FDI/FII) và tư bản tài chính bắt đầu chi phối.',
    unlock: ['Thôn tính ngành của đội khác (trả 2× giá)', 'Hệ số tiền thuê: 2/3 nhóm ×1,5; 3/3 nhóm ×2,5', 'Hội nghị Cartel', 'Xuất khẩu tư bản FDI/FII', 'Nắm đủ 3 ngân hàng = tài phiệt thu 10% tiền thuê', 'Nhà nước điều tiết'],
    ref: 'Lý thuyết: 5 đặc điểm kinh tế cơ bản của độc quyền (V.I.Lênin)',
  },
  3: {
    name: 'Độc quyền và độc quyền nhà nước',
    lead: 'Một vài tập đoàn nắm giữ thị trường.',
    body: 'Nắm 2/3 ngành của một nhóm là chi phối thị trường, nắm đủ 3/3 là định giá độc quyền ×4. Nhà nước can thiệp: thuế lũy tiến, phạt độc quyền, trợ cấp. Tập đoàn có thể vận động hành lang để được miễn nghĩa vụ.',
    unlock: ['Hệ số tiền thuê: 2/3 nhóm ×2; 3/3 nhóm ×4 (giá cả độc quyền)', 'Nhà nước phạt đội chi phối nhóm ngành (100)', 'Vận động hành lang', 'Thẻ thời cuộc về độc quyền nhà nước'],
    ref: 'Lý thuyết: độc quyền nhà nước trong chủ nghĩa tư bản',
  },
};

// ---------- Thẻ "Thời cuộc" / "Khủng hoảng" ----------
// apply(g, t) nhận game g và đội t (đội vừa rơi vào ô), trả về mảng dòng thông báo.
// Hàm hỗ trợ có sẵn trong game.js: g.gain, g.pay, g.richest, g.poorest, g.hasMonopoly...
const CARDS = [
  {
    id: 'cri_overprod', crisis: true, minPhase: 2,
    title: 'Khủng hoảng thừa',
    text: 'Cung vượt cầu, doanh nghiệp yếu phá sản. Đội ít tiền nhất phải bán ngành rẻ nhất cho đội giàu nhất với giá 50%.',
    theory: 'Khủng hoảng thúc đẩy tích tụ và tập trung, một nguyên nhân hình thành độc quyền.',
    apply: (g) => g.cardForcedSale(),
  },
  {
    id: 'cri_fin', crisis: true, minPhase: 2,
    title: 'Khủng hoảng tài chính',
    text: 'Mọi đội mất 10% tiền mặt. Đội nắm ngân hàng thu lại 40 cho mỗi ngân hàng.',
    theory: 'Tư bản tài chính chi phối: khủng hoảng làm tài phiệt mạnh thêm.',
    apply: (g) => g.cardFinCrisis(),
  },
  {
    id: 'cri_bankrun', crisis: true, minPhase: 2,
    title: 'Ngân hàng nhỏ phá sản',
    text: 'Các ngân hàng nhỏ sụp đổ hoặc bị thôn tính. Đội nào đang giữ ngân hàng nhận 100.',
    theory: 'Ngân hàng nhỏ bị phá sản hoặc thôn tính, ngân hàng lớn hợp nhất lại: tiền đề hình thành tư bản tài chính.',
    apply: (g) => g.cardBankRun(),
  },
  {
    id: 'cri_demand', crisis: true, minPhase: 1,
    title: 'Thiếu thị trường tiêu thụ',
    text: 'Hàng tồn kho chất đống, đội của bạn chịu thiệt 60.',
    theory: 'Thiếu thị trường tiêu thụ thúc đẩy xuất khẩu tư bản và tranh giành khu vực ảnh hưởng.',
    apply: (g, t) => g.cardPay(t, 60, 'Hàng tồn kho'),
  },
  {
    id: 'cri_boycott', crisis: true, minPhase: 2,
    title: 'Người tiêu dùng tẩy chay giá độc quyền',
    text: 'Đội nào đang chi phối một nhóm ngành (từ 2/3 ngành trở lên) bị phạt 100. Nếu chưa ai độc quyền, đội của bạn nhận 40 nhờ cạnh tranh gay gắt.',
    theory: 'Tác động tiêu cực: cạnh tranh không hoàn hảo gây thiệt hại người tiêu dùng.',
    apply: (g, t) => g.cardBoycott(t),
  },
  {
    id: 'op_tech', crisis: false, minPhase: 1,
    title: 'Phát minh khoa học – kỹ thuật',
    text: 'Đội bạn nhận 100 và nâng cấp một ngành đang sở hữu (tiền thuê +50%).',
    theory: 'Tác động tích cực: độc quyền tạo khả năng nghiên cứu, triển khai khoa học kỹ thuật.',
    apply: (g, t) => g.cardTech(t),
  },
  {
    id: 'op_scale', crisis: false, minPhase: 1,
    title: 'Sản xuất quy mô lớn',
    text: 'Năng suất lao động tăng nhờ quy mô: nhận 20 cho mỗi ngành đang sở hữu (tối đa 120).',
    theory: 'Tác động tích cực: tăng năng suất lao động, phát triển kinh tế theo hướng sản xuất lớn.',
    apply: (g, t) => g.cardGain(t, Math.min(120, 20 * g.propsOf(t).length), 'Sản xuất quy mô lớn'),
  },
  {
    id: 'op_start', crisis: false, minPhase: 1,
    title: 'Làn sóng khởi nghiệp',
    text: 'Thị trường còn tự do, doanh nghiệp mới ra đời liên tục. Nhận 60.',
    theory: 'Giai đoạn tự do cạnh tranh: nhiều doanh nghiệp nhỏ cùng tồn tại.',
    apply: (g, t) => g.cardGain(t, 60, 'Khởi nghiệp'),
  },
  {
    id: 'op_infra', crisis: false, minPhase: 1,
    title: 'Nhà nước đầu tư hạ tầng',
    text: 'Đường, điện, cảng hoàn thành, tư nhân hưởng lợi. Nhận 50.',
    theory: 'Ngành cần thiết, vốn lớn, thu hồi chậm: nhà nước làm để tư nhân đầu tư ngành khác.',
    apply: (g, t) => g.cardGain(t, 50, 'Hạ tầng nhà nước'),
  },
  {
    id: 'op_ma', crisis: false, minPhase: 2,
    title: 'Làn sóng sáp nhập (M&A)',
    text: 'Nhận 40 cho mỗi nhóm ngành mà đội bạn giữ từ 2 ngành trở lên (liên kết ngang).',
    theory: 'Liên kết ngang, liên kết dọc: tập trung sản xuất và hình thành các tổ chức độc quyền.',
    apply: (g, t) => g.cardMA(t),
  },
  {
    id: 'op_trade', crisis: false, minPhase: 2,
    title: 'Hiệp định phân chia thị trường',
    text: 'Các tập đoàn thỏa hiệp, ký hiệp định chia thị trường. Nhận 80.',
    theory: 'Cạnh tranh quốc tế dẫn tới thỏa hiệp, ký hiệp định phân chia thị trường thế giới.',
    apply: (g, t) => g.cardGain(t, 80, 'Hiệp định thương mại'),
  },
  {
    id: 'op_fdi_in', crisis: false, minPhase: 2,
    title: 'Vốn đầu tư nước ngoài đổ vào',
    text: 'Tập đoàn nước ngoài đặt nhà máy, đội bạn làm đối tác. Nhận 90.',
    theory: 'Xuất khẩu tư bản trực tiếp (FDI) nhằm thu giá trị thặng dư ở nước nhập khẩu tư bản.',
    apply: (g, t) => g.cardGain(t, 90, 'Vốn FDI'),
  },
  {
    id: 'op_stateshare', crisis: false, minPhase: 2,
    title: 'Nhà nước mua cổ phần doanh nghiệp tư nhân',
    text: 'Nhà nước mua cổ phần của đội bạn. Nhận 120.',
    theory: 'Sở hữu nhà nước hình thành qua xây dựng doanh nghiệp nhà nước, quốc hữu hóa, mua cổ phần doanh nghiệp tư nhân.',
    apply: (g, t) => g.cardGain(t, 120, 'Nhà nước mua cổ phần'),
  },
  {
    id: 'op_welfare', crisis: false, minPhase: 2,
    title: 'Phân hóa giàu nghèo',
    text: 'Nhà nước phải xoa dịu mâu thuẫn xã hội: đội giàu nhất nộp 80 trợ cấp cho đội nghèo nhất.',
    theory: 'Nhà nước điều tiết thu nhập, phúc lợi, trợ cấp thất nghiệp để xoa dịu mâu thuẫn do độc quyền tư nhân.',
    apply: (g) => g.cardWelfare(),
  },
  {
    id: 'op_lobby', crisis: false, minPhase: 3,
    title: 'Chủ độc quyền vào Chính phủ',
    text: '“Hôm nay là bộ trưởng, ngày mai là chủ ngân hàng.” Nhận 100 và một lá chắn miễn tiền thuê lần tới.',
    theory: 'Biểu hiện của độc quyền nhà nước: kết hợp về nhân sự giữa tổ chức độc quyền và nhà nước.',
    apply: (g, t) => g.cardLobby(t),
  },
  {
    id: 'op_war', crisis: false, minPhase: 3,
    title: 'Tranh giành lãnh thổ ảnh hưởng',
    text: 'Vận động chính phủ bảo vệ thị trường tốn 70.',
    theory: 'Tài nguyên cạn kiệt, thiếu thị trường: tập đoàn lôi kéo chính phủ phân định khu vực lãnh thổ ảnh hưởng.',
    apply: (g, t) => g.cardPay(t, 70, 'Vận động chính phủ'),
  },
];

// ---------- Ngân hàng câu hỏi ----------
// sec: chủ đề hiện trên màn hình. ans: chỉ số đáp án đúng (trước khi xáo). Nội dung bám giáo trình
// Kinh tế chính trị Mác – Lênin, Chương 4. Các câu "Biểu hiện mới" và "Vai trò lịch sử" thuộc phần cuối chương.
const Q = (sec, q, opts, ans, why) => ({ sec, q, opts, ans, why });
const QUESTIONS = [
  Q('Độc quyền', 'Trong kinh tế chính trị Mác – Lênin, độc quyền được hiểu là gì?',
    ['Liên minh giữa các doanh nghiệp lớn, nắm phần lớn việc sản xuất và tiêu thụ một số loại hàng hóa, có khả năng định giá độc quyền để thu lợi nhuận độc quyền cao',
     'Một doanh nghiệp nhỏ duy nhất còn tồn tại sau khi các đối thủ tự rút khỏi thị trường',
     'Trạng thái cạnh tranh hoàn hảo giữa rất nhiều doanh nghiệp nhỏ, không ai chi phối được giá',
     'Việc nhà nước cố định giá mọi hàng hóa để bảo vệ người tiêu dùng'], 0,
    'Độc quyền là liên minh giữa các doanh nghiệp lớn, nắm trong tay phần lớn việc sản xuất và tiêu thụ một số loại hàng hóa, có khả năng định ra giá cả độc quyền nhằm thu lợi nhuận độc quyền cao.'),
  Q('Độc quyền', 'Quá trình hình thành độc quyền diễn ra theo trình tự nào?',
    ['Tự do cạnh tranh → tích tụ và tập trung sản xuất → độc quyền',
     'Độc quyền → tự do cạnh tranh → tích tụ và tập trung sản xuất',
     'Tích tụ và tập trung sản xuất → độc quyền nhà nước → tự do cạnh tranh',
     'Độc quyền nhà nước → độc quyền tư nhân → tự do cạnh tranh'], 0,
    'Cạnh tranh tự do buộc doanh nghiệp tích tụ, tập trung sản xuất; khi quy mô đủ lớn thì hình thành độc quyền.'),
  Q('Độc quyền', 'Đâu KHÔNG phải là nguyên nhân hình thành độc quyền?',
    ['Nhà nước xóa bỏ hoàn toàn sở hữu tư nhân',
     'Sự phát triển của lực lượng sản xuất',
     'Cạnh tranh gay gắt buộc doanh nghiệp tích tụ, tập trung sản xuất',
     'Khủng hoảng kinh tế và sự phát triển của hệ thống tín dụng'], 0,
    'Độc quyền hình thành do ba nguyên nhân: lực lượng sản xuất phát triển; cạnh tranh; khủng hoảng kinh tế và sự phát triển của hệ thống tín dụng.'),
  Q('Độc quyền', 'Các tổ chức độc quyền áp đặt giá cả độc quyền theo cách nào?',
    ['Mua nguyên liệu, đầu vào với giá thấp và bán hàng hóa với giá cao',
     'Mua đầu vào với giá cao và bán hàng hóa với giá thấp để giành thị phần',
     'Để nhà nước ấn định toàn bộ giá mua và giá bán',
     'Luôn mua và bán đúng bằng giá trị của hàng hóa'], 0,
    'Giá cả độc quyền là giá do tổ chức độc quyền áp đặt: thấp khi mua nguyên liệu, đầu vào và cao khi bán hàng hóa, nhờ đó thu lợi nhuận độc quyền cao.'),
  Q('Độc quyền', 'Lợi nhuận độc quyền cao có nguồn gốc từ đâu?',
    ['Lao động không công của công nhân trong và ngoài xí nghiệp độc quyền, giá trị thặng dư mà tư bản vừa và nhỏ bị mất, lao động thặng dư của người sản xuất nhỏ và nhân dân các nước thuộc địa, phụ thuộc',
     'Hoàn toàn từ năng suất cao nhờ công nghệ, không liên quan đến lao động không công của ai',
     'Từ các khoản trợ cấp mà nhà nước chi cho tổ chức độc quyền hằng năm',
     'Từ việc bán hàng hóa đúng giá trị và tiết kiệm chi phí quản lý'], 0,
    'Lợi nhuận độc quyền cao có 4 nguồn: lao động không công của công nhân xí nghiệp độc quyền; một phần lao động không công của công nhân xí nghiệp ngoài độc quyền; một phần giá trị thặng dư của tư bản vừa và nhỏ bị mất do thua cạnh tranh; lao động thặng dư (đôi khi cả lao động tất yếu) của người sản xuất nhỏ, nhân dân lao động ở các nước tư bản và các nước thuộc địa, phụ thuộc.'),
  Q('Độc quyền nhà nước', 'Độc quyền nhà nước nắm giữ vị thế độc quyền ở những lĩnh vực nào?',
    ['Những lĩnh vực then chốt của nền kinh tế',
     'Mọi lĩnh vực, kể cả buôn bán nhỏ lẻ',
     'Chủ yếu là nông nghiệp truyền thống',
     'Chủ yếu là bán lẻ và dịch vụ ăn uống'], 0,
    'Nhà nước nắm vị thế độc quyền ở những lĩnh vực then chốt của nền kinh tế, tạo sức mạnh vật chất cho sự ổn định của chế độ chính trị - xã hội.'),
  Q('Độc quyền nhà nước', 'Vì sao nhà nước tư sản thường trực tiếp đầu tư vào thủy điện, đường sắt, cảng biển?',
    ['Đây là ngành cần thiết nhưng vốn lớn, thu hồi chậm, lợi nhuận thấp nên tư nhân không muốn làm; nhà nước đầu tư để tư nhân tập trung vào ngành khác',
     'Vì đây là các ngành lợi nhuận rất cao, nhà nước muốn giành hết lợi nhuận',
     'Vì pháp luật cấm tư nhân tham gia mọi ngành sản xuất',
     'Vì nhà nước muốn xóa bỏ hoàn toàn cạnh tranh trên thị trường'], 0,
    'Một nguyên nhân hình thành độc quyền nhà nước: phân công lao động xã hội làm xuất hiện những ngành cần thiết nhưng vốn lớn, thu hồi chậm, lợi nhuận thấp mà tư nhân không muốn đầu tư.'),
  Q('Độc quyền nhà nước', 'Nhà nước tư sản trợ cấp thất nghiệp, phát triển phúc lợi, điều tiết thu nhập nhằm mục đích chính nào?',
    ['Xoa dịu mâu thuẫn xã hội do độc quyền tư nhân gây ra như phân hóa giàu nghèo, thất nghiệp',
     'Xóa bỏ hoàn toàn sự phân hóa giàu nghèo trong xã hội tư bản',
     'Tăng lợi nhuận cho các ngân hàng nước ngoài',
     'Thay thế hoàn toàn cơ chế thị trường bằng kế hoạch hóa'], 0,
    'Độc quyền tư nhân làm sâu sắc mâu thuẫn giữa giai cấp tư sản và người lao động; nhà nước phải trợ cấp, điều tiết thu nhập, phát triển phúc lợi để xoa dịu. Đây là một nguyên nhân hình thành độc quyền nhà nước.'),
  Q('Độc quyền nhà nước', 'Bản chất của độc quyền nhà nước trong chủ nghĩa tư bản là gì?',
    ['Sự kết hợp sức mạnh của các tổ chức độc quyền tư nhân với sức mạnh của nhà nước tư sản, nhằm phục vụ lợi ích của tổ chức độc quyền và duy trì CNTB',
     'Nhà nước đứng trung lập, không phục vụ lợi ích của giai cấp nào',
     'Nhà nước thay mặt người lao động xóa bỏ quan hệ sản xuất tư bản',
     'Nhà nước cạnh tranh để triệt tiêu các tổ chức độc quyền tư nhân'], 0,
    'Độc quyền nhà nước trong CNTB là sự kết hợp sức mạnh của tổ chức độc quyền tư nhân với sức mạnh của nhà nước tư sản thành một thiết chế thống nhất, phục vụ lợi ích của các tổ chức độc quyền và duy trì, phát triển CNTB.'),
  Q('Tác động của độc quyền', 'Tác động nào sau đây là TIÊU CỰC của độc quyền?',
    ['Có thể kìm hãm sự tiến bộ kỹ thuật và phát triển kinh tế - xã hội',
     'Tạo khả năng to lớn cho nghiên cứu, triển khai khoa học kỹ thuật',
     'Làm tăng năng suất lao động',
     'Thúc đẩy nền kinh tế phát triển theo hướng sản xuất lớn hiện đại'], 0,
    'Tác động tiêu cực: cạnh tranh không hoàn hảo gây thiệt hại cho người tiêu dùng và xã hội; có thể kìm hãm tiến bộ kỹ thuật; làm tăng phân hóa giàu nghèo.'),
  Q('Tác động của độc quyền', 'Tác động nào sau đây là TÍCH CỰC của độc quyền?',
    ['Làm tăng năng suất lao động, nâng cao năng lực cạnh tranh của tổ chức độc quyền',
     'Làm tăng sự phân hóa giàu nghèo',
     'Gây thiệt hại cho người tiêu dùng do định giá độc quyền',
     'Có thể kìm hãm tiến bộ kỹ thuật'], 0,
    'Tác động tích cực: tạo khả năng nghiên cứu, triển khai khoa học kỹ thuật; tăng năng suất lao động, nâng cao năng lực cạnh tranh; thúc đẩy kinh tế phát triển theo hướng sản xuất lớn hiện đại.'),
  Q('Cạnh tranh trong độc quyền', 'Khi độc quyền xuất hiện, cạnh tranh trên thị trường thay đổi thế nào?',
    ['Không bị triệt tiêu mà trở nên đa dạng, gay gắt hơn',
     'Bị triệt tiêu hoàn toàn',
     'Chỉ còn cạnh tranh giữa những người tiêu dùng với nhau',
     'Trở nên ôn hòa, không còn đối kháng'], 0,
    'Độc quyền ra đời không thủ tiêu cạnh tranh mà làm cho cạnh tranh trở nên đa dạng, gay gắt hơn.'),
  Q('Cạnh tranh trong độc quyền', 'Hai doanh nghiệp cùng nằm trong một tổ chức độc quyền giành thị phần của nhau. Đó là loại cạnh tranh nào?',
    ['Cạnh tranh trong nội bộ tổ chức độc quyền',
     'Cạnh tranh giữa tổ chức độc quyền và doanh nghiệp ngoài độc quyền',
     'Cạnh tranh giữa các tổ chức độc quyền với nhau',
     'Cạnh tranh hoàn hảo'], 0,
    'Có ba loại cạnh tranh: giữa tổ chức độc quyền với doanh nghiệp ngoài độc quyền; giữa các tổ chức độc quyền với nhau; trong nội bộ một tổ chức độc quyền.'),
  Q('Tổ chức độc quyền', 'Khi sản xuất đã tập trung cao, vì sao các tổ chức độc quyền dễ đạt được thỏa thuận với nhau?',
    ['Vì số lượng doanh nghiệp lớn còn lại ít',
     'Vì giữa họ không còn lợi ích riêng',
     'Vì nhà nước bắt buộc họ phải thỏa thuận',
     'Vì quy mô mỗi doanh nghiệp còn rất nhỏ'], 0,
    'Tập trung sản xuất khiến chỉ còn ít doanh nghiệp lớn: số lượng ít nên dễ thỏa thuận, quy mô lớn nên khó đánh bại nhau, từ đó cùng chi phối thị trường.'),
  Q('Năm đặc điểm của độc quyền', 'Theo V.I.Lênin, chủ nghĩa tư bản độc quyền có mấy đặc điểm kinh tế cơ bản?',
    ['5 đặc điểm', '3 đặc điểm', '4 đặc điểm', '7 đặc điểm'], 0,
    'Năm đặc điểm: (1) tập trung sản xuất và các tổ chức độc quyền; (2) tư bản tài chính và hệ thống tài phiệt; (3) xuất khẩu tư bản; (4) phân chia thế giới về kinh tế giữa các tổ chức độc quyền; (5) phân chia thế giới về lãnh thổ giữa các cường quốc.'),
  Q('Năm đặc điểm của độc quyền', 'Đâu KHÔNG thuộc 5 đặc điểm kinh tế của độc quyền theo V.I.Lênin?',
    ['Cạnh tranh tự do hoàn hảo giữa vô số doanh nghiệp nhỏ',
     'Xuất khẩu tư bản trở thành phổ biến',
     'Tư bản tài chính và hệ thống tài phiệt chi phối',
     'Các tổ chức độc quyền phân chia thị trường thế giới'], 0,
    'Cạnh tranh tự do là đặc trưng của giai đoạn trước độc quyền, không thuộc 5 đặc điểm.'),
  Q('Tổ chức độc quyền', 'Hình thức tổ chức độc quyền nào chỉ thỏa thuận về giá cả, sản lượng, thị trường tiêu thụ, kỳ hạn thanh toán, nên không vững chắc và thường tan vỡ trước kỳ hạn?',
    ['Cartel', 'Trust', 'Syndicate', 'Consortium'], 0,
    'Cartel: các thành viên thỏa thuận về giá cả, sản lượng, thị trường nhưng vẫn độc lập về sản xuất và lưu thông, nên rất dễ tan vỡ.'),
  Q('Tổ chức độc quyền', 'Hình thức nào thống nhất cả sản xuất lẫn lưu thông dưới một ban quản trị, các nhà tư bản tham gia trở thành cổ đông và hưởng lợi theo số cổ phần?',
    ['Trust', 'Cartel', 'Syndicate', 'Liên kết ngang'], 0,
    'Trust: việc sản xuất, tiêu thụ, tài vụ do một ban quản trị chung đảm nhận; các nhà tư bản thành cổ đông, hưởng lợi nhuận theo cổ phần.'),
  Q('Tổ chức độc quyền', 'Hình thức nào để các xí nghiệp độc lập về sản xuất, nhưng một ban quản trị chung lo việc mua đầu vào và bán hàng, nhằm mua rẻ, bán đắt?',
    ['Syndicate', 'Cartel', 'Trust', 'Consortium'], 0,
    'Syndicate: thống nhất khâu lưu thông (mua đầu vào, bán đầu ra do ban quản trị chung đảm nhận), ổn định hơn cartel.'),
  Q('Tổ chức độc quyền', 'Hình thức nào có quy mô lớn nhất, gồm nhiều trust, syndicate thuộc các ngành khác nhau nhưng liên quan về kinh tế, kỹ thuật (liên kết dọc)?',
    ['Consortium', 'Cartel', 'Syndicate', 'Doanh nghiệp nhỏ lẻ'], 0,
    'Consortium: liên kết dọc nhiều trust, syndicate của các ngành có liên quan, phụ thuộc vào một nhóm tư bản tài chính lớn.'),
  Q('Tổ chức độc quyền', 'Liên kết ngang giữa các doanh nghiệp được hiểu là gì?',
    ['Liên kết giữa các doanh nghiệp cùng ngành, cùng lĩnh vực',
     'Liên kết giữa doanh nghiệp và cơ quan nhà nước',
     'Liên kết giữa ngân hàng và người gửi tiết kiệm',
     'Liên kết giữa doanh nghiệp và công nhân của mình'], 0,
    'Liên kết ngang: giữa các doanh nghiệp cùng ngành. Liên kết dọc: giữa các ngành, các khâu có quan hệ với nhau trong chuỗi sản xuất - tiêu thụ.'),
  Q('Tư bản tài chính', 'Tư bản tài chính theo V.I.Lênin là gì?',
    ['Sự hợp nhất giữa tư bản ngân hàng của một số ít ngân hàng độc quyền lớn với tư bản của các liên minh công nghiệp độc quyền',
     'Toàn bộ tiền nhàn rỗi trong tay người tiêu dùng',
     'Quỹ dự trữ ngoại hối của nhà nước',
     'Số tiền các ngân hàng nhỏ cho vay lẻ'], 0,
    'Tư bản tài chính là sự dung hợp giữa tư bản ngân hàng độc quyền và tư bản công nghiệp độc quyền; từ đó hình thành nhóm tài phiệt chi phối nền kinh tế.'),
  Q('Tư bản tài chính', 'Điều gì xảy ra với các ngân hàng nhỏ trong quá trình tập trung tư bản ngân hàng?',
    ['Bị phá sản hoặc bị thôn tính, các ngân hàng lớn hợp nhất lại',
     'Phát triển mạnh nhờ được độc quyền bảo hộ',
     'Được nhà nước giữ nguyên, không cho sáp nhập',
     'Không chịu ảnh hưởng gì'], 0,
    'Ngân hàng nhỏ không đủ tiềm lực phục vụ các doanh nghiệp công nghiệp lớn nên bị phá sản hoặc bị thôn tính, hình thành ngân hàng độc quyền.'),
  Q('Tư bản tài chính', '“Chế độ tham dự” của các nhà tài phiệt là gì?',
    ['Nắm cổ phần khống chế ở công ty mẹ để chi phối dây chuyền công ty con, công ty cháu',
     'Cho các công ty con vay vốn với lãi suất thấp',
     'Chia đều cổ phần cho toàn bộ công nhân',
     'Nhà nước cử người tham gia điều hành ngân hàng'], 0,
    'Tài phiệt nắm cổ phần khống chế công ty mẹ, công ty mẹ lại nắm cổ phần khống chế công ty con…: dùng một lượng vốn nhỏ để chi phối lượng tư bản lớn hơn nhiều.'),
  Q('Xuất khẩu tư bản', 'Xuất khẩu tư bản là gì?',
    ['Đầu tư tư bản ra nước ngoài nhằm thu giá trị thặng dư và các nguồn lợi nhuận khác ở nước nhập khẩu tư bản',
     'Bán hàng hóa thành phẩm ra nước ngoài',
     'Đưa người lao động sang làm việc ở nước khác',
     'Gửi tiền tiết kiệm ở ngân hàng nước ngoài'], 0,
    'Xuất khẩu tư bản là xuất khẩu giá trị (đầu tư tư bản) ra nước ngoài để chiếm đoạt giá trị thặng dư và các nguồn lợi nhuận khác ở nước nhập khẩu tư bản.'),
  Q('Xuất khẩu tư bản', 'Samsung bỏ vốn xây nhà máy và trực tiếp quản lý sản xuất tại Việt Nam. Đó là hình thức xuất khẩu tư bản nào?',
    ['Đầu tư trực tiếp (FDI)', 'Đầu tư gián tiếp (FII)', 'Cartel quốc tế', 'Viện trợ không hoàn lại'], 0,
    'Nhà đầu tư bỏ vốn xây dựng và trực tiếp điều hành cơ sở sản xuất ở nước ngoài: đó là đầu tư trực tiếp (FDI).'),
  Q('Xuất khẩu tư bản', 'Một quỹ đầu tư nước ngoài mua cổ phiếu, trái phiếu của doanh nghiệp Việt Nam nhưng không trực tiếp điều hành doanh nghiệp. Đó là hình thức nào?',
    ['Đầu tư gián tiếp (FII)', 'Đầu tư trực tiếp (FDI)', 'Độc quyền nhà nước', 'Syndicate'], 0,
    'Nhà đầu tư chỉ mua chứng khoán để hưởng lợi tức, không trực tiếp quản lý doanh nghiệp: đó là đầu tư gián tiếp (FII).'),
  Q('Phân chia thị trường thế giới', 'Cạnh tranh quốc tế giữa các tập đoàn độc quyền thường dẫn tới điều gì?',
    ['Hình thành các tổ chức độc quyền quốc tế, xu hướng thỏa hiệp và ký hiệp định phân chia thị trường',
     'Chấm dứt hoàn toàn mọi cạnh tranh',
     'Các tập đoàn tự giải thể',
     'Nhà nước xóa bỏ thị trường thế giới'], 0,
    'Tích tụ trong nước → xuất khẩu tư bản → cạnh tranh quốc tế → hình thành cartel, syndicate, trust quốc tế, xu hướng thỏa hiệp và ký hiệp định chia thị trường.'),
  Q('Phân chia lãnh thổ thế giới', 'Khi nguồn nguyên liệu cạn dần và thiếu thị trường tiêu thụ, các tập đoàn độc quyền thường làm gì?',
    ['Lôi kéo, thúc đẩy chính phủ tranh giành, phân định khu vực lãnh thổ ảnh hưởng',
     'Đóng cửa toàn bộ sản xuất',
     'Tự giảm giá để triệt tiêu độc quyền',
     'Chia toàn bộ lợi nhuận cho công nhân'], 0,
    'Để bảo đảm nguyên liệu và thị trường, các tập đoàn độc quyền thúc đẩy chính phủ các cường quốc tranh giành, phân chia khu vực lãnh thổ ảnh hưởng.'),
  Q('Biểu hiện của độc quyền nhà nước', 'Câu “Hôm nay là bộ trưởng, ngày mai là chủ ngân hàng” minh họa biểu hiện nào của độc quyền nhà nước?',
    ['Sự kết hợp về nhân sự giữa tổ chức độc quyền và nhà nước',
     'Sự hình thành và phát triển sở hữu nhà nước',
     'Nhà nước điều tiết kinh tế bằng thuế',
     'Nhà nước xóa bỏ độc quyền tư nhân'], 0,
    'Người của tập đoàn nắm chức vụ trong bộ máy nhà nước và ngược lại, tạo ra “chính phủ đằng sau chính phủ”: đó là sự kết hợp về nhân sự.'),
  Q('Biểu hiện của độc quyền nhà nước', 'Sở hữu nhà nước trong CNTB được hình thành bằng những cách nào?',
    ['Xây dựng doanh nghiệp nhà nước, quốc hữu hóa doanh nghiệp tư nhân bằng cách mua lại, mua cổ phần doanh nghiệp tư nhân',
     'Chủ yếu bằng cách phát hành thêm tiền',
     'Chia tài sản của doanh nghiệp cho từng hộ dân',
     'Tịch thu toàn bộ tài sản tư nhân mà không bồi thường'], 0,
    'Sở hữu nhà nước hình thành bằng cách: xây dựng doanh nghiệp nhà nước bằng vốn ngân sách; quốc hữu hóa doanh nghiệp tư nhân bằng cách mua lại; mua cổ phần doanh nghiệp tư nhân; mở rộng doanh nghiệp nhà nước bằng vốn tích lũy của doanh nghiệp tư nhân.'),
  Q('Biểu hiện của độc quyền nhà nước', 'Sở hữu nhà nước giúp ích thế nào cho các tổ chức độc quyền tư nhân?',
    ['Mở rộng địa bàn cho sản xuất TBCN, giúp tổ chức độc quyền di chuyển tư bản thuận lợi và làm chỗ dựa cho nhà nước điều tiết kinh tế',
     'Buộc các tổ chức độc quyền tư nhân phải giải thể',
     'Chuyển toàn bộ lợi nhuận độc quyền cho người lao động',
     'Thay thế hoàn toàn sở hữu tư nhân về tư liệu sản xuất'], 0,
    'Sở hữu nhà nước mở rộng sản xuất TBCN, bảo đảm địa bàn cho độc quyền phát triển, tạo điều kiện di chuyển tư bản và làm chỗ dựa cho việc điều tiết kinh tế.'),
  Q('Biểu hiện của độc quyền nhà nước', 'Nhà nước tư sản điều tiết nền kinh tế chủ yếu bằng những công cụ nào?',
    ['Ngân sách, thuế, hệ thống tiền tệ - tín dụng và pháp luật',
     'Chủ yếu bằng mệnh lệnh hành chính và kế hoạch hóa tập trung',
     'Chủ yếu bằng viện trợ của các nước khác',
     'Chủ yếu bằng quảng cáo và vận động người tiêu dùng'], 0,
    'Bộ máy lập pháp, hành pháp, tư pháp sử dụng ngân sách, thuế, tiền tệ - tín dụng, pháp luật để điều tiết kinh tế.'),
  Q('Biểu hiện của độc quyền nhà nước', 'Cơ chế kết hợp “thị trường + độc quyền tư nhân + điều tiết của nhà nước” nhằm mục tiêu gì?',
    ['Hạn chế mặt tiêu cực và phát huy mặt tích cực của độc quyền tư nhân',
     'Tiêu diệt mọi doanh nghiệp tư nhân',
     'Tăng thuế đối với người nghèo',
     'Biến mọi doanh nghiệp thành cartel'], 0,
    'Cơ chế điều tiết này nhằm hạn chế mặt tiêu cực, phát huy mặt tích cực của độc quyền tư nhân và duy trì sự ổn định của CNTB.'),
  Q('Tích tụ và tập trung tư bản', 'Tập trung tư bản khác tích tụ tư bản ở điểm nào?',
    ['Tập trung là hợp nhất nhiều tư bản sẵn có thành tư bản lớn hơn; tích tụ là tăng quy mô tư bản bằng tư bản hóa giá trị thặng dư',
     'Hai khái niệm hoàn toàn giống nhau',
     'Tích tụ là hợp nhất các tư bản; tập trung là tiết kiệm tiêu dùng',
     'Tập trung chỉ diễn ra trong doanh nghiệp nhà nước'], 0,
    'Tích tụ: tăng quy mô tư bản cá biệt bằng cách tư bản hóa giá trị thặng dư. Tập trung: sáp nhập, thôn tính các tư bản sẵn có thành tư bản lớn hơn.'),
  Q('Biểu hiện mới của độc quyền', 'Biểu hiện mới nổi bật của độc quyền trong điều kiện ngày nay là gì?',
    ['Sự phát triển của các công ty độc quyền xuyên quốc gia chi phối kinh tế toàn cầu',
     'Sự quay trở lại của các phường hội thủ công',
     'Chợ truyền thống thay thế các tập đoàn lớn',
     'Doanh nghiệp lớn biến mất, chỉ còn hộ sản xuất cá thể'], 0,
    'Ngày nay các công ty xuyên quốc gia phát triển mạnh, mở rộng sản xuất và chi phối kinh tế toàn cầu; bên cạnh đó các doanh nghiệp vừa và nhỏ vẫn phát triển.'),
  Q('Vai trò lịch sử của CNTB', 'Vai trò lịch sử tích cực của chủ nghĩa tư bản là gì?',
    ['Phát triển mạnh lực lượng sản xuất, chuyển sản xuất nhỏ thành sản xuất lớn hiện đại, thúc đẩy xã hội hóa sản xuất',
     'Xóa bỏ hoàn toàn bóc lột trong xã hội',
     'Chấm dứt mọi cuộc khủng hoảng kinh tế',
     'Làm cạnh tranh biến mất khỏi nền kinh tế'], 0,
    'Vai trò tích cực của CNTB: phát triển lực lượng sản xuất; chuyển nền sản xuất nhỏ thành sản xuất lớn hiện đại; thực hiện xã hội hóa sản xuất, tạo tiền đề vật chất cho xã hội mới.'),
  Q('Vai trò lịch sử của CNTB', 'Giới hạn lịch sử của CNTB bắt nguồn từ mâu thuẫn cơ bản nào?',
    ['Giữa trình độ xã hội hóa ngày càng cao của lực lượng sản xuất và chế độ chiếm hữu tư nhân TBCN về tư liệu sản xuất',
     'Giữa người tiêu dùng và nhà nước',
     'Giữa nông nghiệp và công nghiệp',
     'Giữa thành thị và nông thôn'], 0,
    'Mâu thuẫn giữa trình độ xã hội hóa ngày càng cao của lực lượng sản xuất với chế độ chiếm hữu tư nhân TBCN về tư liệu sản xuất là mâu thuẫn cơ bản, tạo nên giới hạn lịch sử của CNTB.'),
];

module.exports = {
  TEAM_DEFS, GROUPS, TILES, START_CASH, SALARY, FDI_COST, FDI_YIELD, FII_COST, FII_RETURNS,
  RD_COST, LOBBY_COST, BANK_RENT, MULT, PHASES, CARDS, QUESTIONS,
};
