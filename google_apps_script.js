/**
 * =========================================================================
 * CJ CAU TRE / CJ FOODS VIETNAM - MARKET AUDIT SYSTEM
 * GOOGLE APPS SCRIPT BACKEND (GOOGLE SHEETS & GOOGLE DRIVE)
 * HỖ TRỢ ĐỒNG BỘ 2 HÌNH ẢNH: TỦ ĐÔNG & TỔNG QUAN CỬA HÀNG
 * =========================================================================
 * Hướng dẫn cập nhật:
 * 1. Mở file Google Sheets của bạn ("CJ_Market_Audit_Data_2026")
 * 2. Vào Tiện ích mở rộng (Extensions) -> Apps Script
 * 3. Xóa toàn bộ mã cũ trong Code.gs, DÁN TOÀN BỘ MÃ NÀY VÀO.
 * 4. Bấm "Triển khai" (Deploy) -> "Quản lý bản triển khai" (Manage deployments)
 *    -> Bấm biểu tượng cây bút (Chỉnh sửa / Edit) -> Phiên bản (Version): "Mới" (New)
 *    -> Bấm "Triển khai" (Deploy).
 * =========================================================================
 */

var SHEET_NAME = "DuLieuKiemTra";
var FOLDER_NAME = "CJ_Market_Audit_Photos";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  
  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Kết nối hệ thống Google Sheets & Drive CJ Foods (2 Ảnh) thành công!",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "CJ Audit Web Service (2 Photos Supported) is active"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Không nhận được dữ liệu (Empty payload)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    // Nếu chưa có sheet, tự động tạo và định dạng header chuẩn
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      initSheetHeader(sheet);
    } else {
      // Tự động kiểm tra và nâng cấp tiêu đề sang 2 cột ảnh nếu đang dùng mẫu cũ
      upgradeSheetHeader(sheet);
    }

    // 1. Xử lý lưu ảnh 1: Tủ đông vào Google Drive
    var photoPosmBase64 = data.photoPosm || data.photo || "";
    var photoPosmUrl = "";
    var fileIdPosm = "";
    if (photoPosmBase64 && photoPosmBase64.indexOf("data:image") !== -1) {
      var uploadResPosm = savePhotoToDrive(photoPosmBase64, data.customerCode, data.userCode, "TUDONG");
      photoPosmUrl = uploadResPosm.url;
      fileIdPosm = uploadResPosm.id;
    } else if (data.photoPosmUrl || data.photoUrl) {
      photoPosmUrl = data.photoPosmUrl || data.photoUrl;
    }

    // 2. Xử lý lưu ảnh 2: Tổng quan cửa hàng vào Google Drive
    var photoOverviewBase64 = data.photoOverview || "";
    var photoOverviewUrl = "";
    var fileIdOverview = "";
    if (photoOverviewBase64 && photoOverviewBase64.indexOf("data:image") !== -1) {
      var uploadResOv = savePhotoToDrive(photoOverviewBase64, data.customerCode, data.userCode, "TONGQUAN");
      photoOverviewUrl = uploadResOv.url;
      fileIdOverview = uploadResOv.id;
    } else if (data.photoOverviewUrl) {
      photoOverviewUrl = data.photoOverviewUrl;
    }

    // Chuẩn bị dòng dữ liệu đầy đủ 25 cột
    var timestamp = new Date();
    var rowData = [
      formatDate(timestamp),                         // A: Thời Gian Lưu
      data.userCode || "",                           // B: Mã Nhân Viên
      data.userName || "",                           // C: Tên Nhân Viên
      data.region || "",                             // D: Vùng / Khu Vực
      data.customerCode || "",                       // E: Mã Khách Hàng
      data.customerName || "",                       // F: Tên Khách Hàng
      data.address || "",                            // G: Địa Chỉ
      data.phone || "",                              // H: Số Điện Thoại
      data.freezerBarcode || data.barcode || "",    // I: Mã Tủ / Serial
      data.freezerModel || "",                       // J: Tên Tủ / Model
      data.freezerQuantity || 1,                     // K: Số Lượng Tủ
      data.workingCondition || "",                   // L: Tình Trạng Tủ
      data.conditionNote || "",                      // M: Ghi Chú Tình Trạng
      data.cleanliness || "",                        // N: Vệ Sinh Tủ
      data.stockCompliance || "",                    // O: Tình Trạng Hàng Hóa
      data.displayLocation || "",                    // P: Vị Trí Trưng Bày
      data.posmStatus || "",                         // Q: POSM / Dán Nhãn
      data.notes || "",                              // R: Ghi Chú Chung
      data.latitude || "",                           // S: Vĩ Độ (Lat)
      data.longitude || "",                          // T: Kinh Độ (Lng)
      data.distanceMeters || "",                     // U: Khoảng Cách (m)
      photoPosmUrl || "Không có ảnh",                // V: Cột Ảnh 1 (Tủ đông)
      photoOverviewUrl || "Không có ảnh",            // W: Cột Ảnh 2 (Tổng quan CH)
      fileIdPosm || "",                              // X: Drive ID (Tủ đông)
      fileIdOverview || ""                           // Y: Drive ID (Tổng quan)
    ];

    sheet.appendRow(rowData);
    var lastRow = sheet.getLastRow();

    // Gán Hyperlink native chuẩn cho Ảnh 1: Tủ Đông (Cột 22 / V)
    if (photoPosmUrl) {
      var richTextPosm = SpreadsheetApp.newRichTextValue()
        .setText("🔗 Xem Ảnh Tủ Đông")
        .setLinkUrl(photoPosmUrl)
        .build();
      sheet.getRange(lastRow, 22).setRichTextValue(richTextPosm);
    }

    // Gán Hyperlink native chuẩn cho Ảnh 2: Tổng Quan Cửa Hàng (Cột 23 / W)
    if (photoOverviewUrl) {
      var richTextOv = SpreadsheetApp.newRichTextValue()
        .setText("🔗 Xem Ảnh Tổng Quan CH")
        .setLinkUrl(photoOverviewUrl)
        .build();
      sheet.getRange(lastRow, 23).setRichTextValue(richTextOv);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Đã lưu thành công 2 hình ảnh & dữ liệu kiểm tra lên Google Sheets!",
      row: lastRow,
      photoPosmUrl: photoPosmUrl,
      photoOverviewUrl: photoOverviewUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi xử lý server Apps Script: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Tự động kiểm tra và nâng cấp tiêu đề bảng tính từ 1 ảnh sang 2 ảnh
 */
function upgradeSheetHeader(sheet) {
  try {
    var valV = sheet.getRange(1, 22).getValue();
    var valW = sheet.getRange(1, 23).getValue();
    
    // Nếu tiêu đề cột V đang là "Hình Ảnh Bằng Chứng" hoặc cột W là "Drive File ID"
    if (valV === "Hình Ảnh Bằng Chứng" || valW === "Drive File ID") {
      sheet.getRange(1, 22).setValue("Ảnh 1: Tủ Đông");
      sheet.getRange(1, 23).setValue("Ảnh 2: Tổng Quan CH");
      sheet.getRange(1, 24).setValue("Drive ID (Tủ Đông)");
      sheet.getRange(1, 25).setValue("Drive ID (Tổng Quan)");

      var hRange = sheet.getRange(1, 22, 1, 4);
      hRange.setBackground("#c62828")
            .setFontColor("#ffffff")
            .setFontWeight("bold")
            .setHorizontalAlignment("center")
            .setVerticalAlignment("middle");

      sheet.setColumnWidth(22, 160);
      sheet.setColumnWidth(23, 170);
      sheet.setColumnWidth(24, 150);
      sheet.setColumnWidth(25, 150);
    }
  } catch (e) {
    console.warn("Lỗi khi kiểm tra nâng cấp header:", e);
  }
}

/**
 * Khởi tạo Header chuẩn 25 cột cho Google Sheet
 */
function initSheetHeader(sheet) {
  var headers = [
    "Thời Gian Lưu",
    "Mã NV",
    "Tên Nhân Viên",
    "Khu Vực",
    "Mã Cửa Hàng",
    "Tên Cửa Hàng",
    "Địa Chỉ",
    "Số Điện Thoại",
    "Mã Tủ (Barcode/Serial)",
    "Tên Tủ (Model)",
    "Số Lượng Tủ",
    "Tình Trạng Tủ",
    "Ghi Chú Tình Trạng",
    "Vệ Sinh Tủ",
    "Hàng Hóa Trong Tủ",
    "Vị Trí Trưng Bày",
    "POSM & Nhãn Hiệu",
    "Ghi Chú Chung",
    "GPS Vĩ Độ",
    "GPS Kinh Độ",
    "Khoảng Cách (m)",
    "Ảnh 1: Tủ Đông",
    "Ảnh 2: Tổng Quan CH",
    "Drive ID (Tủ Đông)",
    "Drive ID (Tổng Quan)"
  ];
  
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#c62828") // CJ Foods Brand Red
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  
  // Set default column widths for readability
  sheet.setColumnWidth(1, 150); // Time
  sheet.setColumnWidth(2, 90);  // Code
  sheet.setColumnWidth(3, 140); // Name
  sheet.setColumnWidth(4, 90);  // Region
  sheet.setColumnWidth(5, 110); // Cust Code
  sheet.setColumnWidth(6, 200); // Cust Name
  sheet.setColumnWidth(7, 260); // Address
  sheet.setColumnWidth(8, 120); // Phone
  sheet.setColumnWidth(9, 130); // Barcode
  sheet.setColumnWidth(10, 160); // Model
  sheet.setColumnWidth(12, 140); // Status
  sheet.setColumnWidth(22, 160); // Photo 1 Link (Tủ đông)
  sheet.setColumnWidth(23, 170); // Photo 2 Link (Tổng quan)
  sheet.setColumnWidth(24, 150); // File ID 1
  sheet.setColumnWidth(25, 150); // File ID 2
}

/**
 * Lưu ảnh chụp Base64 trực tiếp vào thư mục Google Drive chuyên biệt
 */
function savePhotoToDrive(base64Data, customerCode, userCode, typeTag) {
  var folder;
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  // Tách base64 data
  var base64String = base64Data;
  if (base64Data.indexOf(",") !== -1) {
    base64String = base64Data.split(",")[1];
  }
  
  var decoded = Utilities.base64Decode(base64String);
  var timeStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
  var safeCust = (customerCode || "OUTLET").replace(/[^a-zA-Z0-9_-]/g, "");
  var safeUser = (userCode || "SR").replace(/[^a-zA-Z0-9_-]/g, "");
  var prefix = typeTag ? (typeTag + "_") : "AUDIT_";
  var fileName = prefix + safeCust + "_" + safeUser + "_" + timeStr + ".jpg";
  
  var blob = Utilities.newBlob(decoded, "image/jpeg", fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Link mở ảnh trực tiếp trên trình duyệt
  var viewUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";
  
  return {
    url: viewUrl,
    id: file.getId()
  };
}

function formatDate(date) {
  return Utilities.formatDate(date, "GMT+7", "yyyy-MM-dd HH:mm:ss");
}

/**
 * Hàm hỗ trợ chạy thủ công một lần để đổi tiêu đề bảng tính nếu cần
 */
function chayNangCapHeaderThuCong() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  upgradeSheetHeader(sheet);
}
