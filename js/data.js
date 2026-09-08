/**
 * CJ MarketAudit - Comprehensive FMCG Database for CJ Foods Vietnam
 * Strictly partitioned by GSBH (Giám Sát Bán Hàng) and Direct Sales Reps (NVBH)
 */

const GSBH_ACCOUNTS = [
  {
    username: "admin",
    empCode: "CJ9999999",
    password: "123",
    name: "Trần Anh Tuấn",
    role: "admin",
    roleTitle: "Giám Đốc RTM & DMS Toàn Quốc",
    area: "Toàn Quốc (GT, MT, B2B)",
    phone: "0901 888 999",
    email: "tuan.ta@cjfoods.vn",
    avatar: "👑",
    teamSalesReps: []
  }
];

const INITIAL_STORES = [];

const INITIAL_FREEZERS = [];

const INITIAL_AUDITS = [];

const CJ_PRODUCTS = [
  {
    id: "PRD-001",
    code: "BBG-MANDU-THIT",
    name: "Bánh Xếp Bibigo Mandu Thịt & Bắp (Gói 350g)",
    brand: "Bibigo",
    category: "Thực Phẩm Đông Lạnh",
    packing: "Thùng 20 gói x 350g",
    price: 42000,
    retailPrice: 50000,
    unit: "gói",
    image: "🥟",
    tempRequirement: "-18°C"
  },
  {
    id: "PRD-002",
    code: "BBG-MANDU-HAISAN",
    name: "Bánh Xếp Bibigo Mandu Hải Sản (Gói 350g)",
    brand: "Bibigo",
    category: "Thực Phẩm Đông Lạnh",
    packing: "Thùng 20 gói x 350g",
    price: 45000,
    retailPrice: 54000,
    unit: "gói",
    image: "🥟",
    tempRequirement: "-18°C"
  },
  {
    id: "PRD-003",
    code: "BBG-KIMCHI-500G",
    name: "Kim Chi Cải Thảo Cắt Lát Bibigo (Hộp 500g)",
    brand: "Bibigo",
    category: "Thực Phẩm Mát / Lên Men",
    packing: "Thùng 12 hộp x 500g",
    price: 36000,
    retailPrice: 44000,
    unit: "hộp",
    image: "🥬",
    tempRequirement: "0°C - 5°C"
  },
  {
    id: "PRD-004",
    code: "CT-CHAGIO-RE-500G",
    name: "Chả Giò Rế Tôm Thịt Đặc Biệt Cầu Tre (Gói 500g)",
    brand: "Cầu Tre",
    category: "Thực Phẩm Đông Lạnh",
    packing: "Thùng 16 gói x 500g",
    price: 49000,
    retailPrice: 59000,
    unit: "gói",
    image: "🍤",
    tempRequirement: "-18°C"
  },
  {
    id: "PRD-005",
    code: "CJ-XUCXICH-PHOMAI",
    name: "Xúc Xích Phô Mai Tiệt Trùng CJ Foods (Gói 175g)",
    brand: "CJ Foods",
    category: "Thực Phẩm Tiệt Trùng",
    packing: "Thùng 24 gói x 175g",
    price: 23000,
    retailPrice: 28000,
    unit: "gói",
    image: "🌭",
    tempRequirement: "Nhiệt độ thường"
  }
];

const CJ_PROMOTIONS = [
  {
    id: "KM-2026-0901",
    title: "Mua 5 Thùng Mandu Tặng 1 Thùng Chả Giò Cầu Tre",
    code: "KM-MANDU-T9",
    targetChannel: "GT (Tạp Hóa / Đại Lý)",
    validUntil: "30/09/2026",
    reward: "Tặng 1 Thùng Chả Giò Rế Cầu Tre trị giá 784.000đ",
    condition: "Áp dụng cho đơn hàng Sell-out từ 5 thùng Bánh xếp Mandu Bibigo bất kỳ.",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300"
  },
  {
    id: "KM-2026-0902",
    title: "Trưng Bày Tủ Chuẩn 100% - Thưởng 200.000đ / Tháng",
    code: "KM-TB-FREEZER",
    targetChannel: "GT (Điểm bán đặt tủ CJ)",
    validUntil: "31/12/2026",
    reward: "Thưởng tiền mặt 200.000đ trừ trực tiếp vào đơn Sell-out",
    condition: "Duy trì tủ cắm điện liên tục ≤ -15°C, tem QR nguyên vẹn và SOS hàng CJ ≥ 80%.",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300"
  },
  {
    id: "KM-2026-0903",
    title: "Tích Lũy Doanh Số Kim Chi Đạt 5 Triệu - Chiết Khấu Thêm 3%",
    code: "KM-KIMCHI-TL",
    targetChannel: "GT (Toàn Quốc)",
    validUntil: "15/10/2026",
    reward: "Chiết khấu thêm 3% trên toàn bộ hóa đơn",
    condition: "Doanh số tích lũy tháng của dòng sản phẩm Kim Chi Bibigo đạt mốc 5.000.000đ.",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300"
  }
];
