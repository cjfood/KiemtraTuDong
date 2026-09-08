/**
 * =========================================================================
 * CJ CAU TRE / CJ FOODS VIETNAM - MARKET AUDIT SYSTEM
 * GOOGLE APPS SCRIPT BACKEND (GOOGLE SHEETS & GOOGLE DRIVE)
 * =========================================================================
 * Hướng dẫn triển khai:
 * 1. Mở Google Sheet mới trên Google Drive của bạn (VD: "CJ_Market_Audit_Data_2026")
 * 2. Vào Tiện ích mở rộng (Extensions) -> Apps Script
 * 3. Xóa hết mã cũ trong Code.gs, dán toàn bộ nội dung file này vào.
 * 4. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
 * 5. Loại: "Ứng dụng web" (Web App)
 *    - Mô tả: "CJ Audit Backend API"
 *    - Thực thi dưới dạng: "Tôi" (Me)
 *    - Ai có quyền truy cập: "Bất kỳ ai" (Anyone) -> RẤT QUAN TRỌNG!
 * 6. Bấm "Triển khai" -> Cấp quyền truy cập Google Drive & Sheets -> Sao chép URL Web App.
 * 7. Dán URL Web App này vào Cài đặt Google Sheet trên Web App Kiểm Tra Thị Trường.
 * =========================================================================
 */

var SHEET_NAME = "DuLieuKiemTra";
var FOLDER_NAME = "CJ_Market_Audit_Photos";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  
  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Kết nối hệ thống Google Sheets & Drive CJ Foods thành công!",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "CJ Audit Web Service is active"
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
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Nếu chưa có sheet, tự động tạo và định dạng header chuẩn
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      initSheetHeader(sheet);
    }

    // Xử lý lưu ảnh vào Google Drive nếu có
    var photoUrl = "";
    var fileId = "";
    if (data.photo && data.photo.indexOf("data:image") !== -1) {
      var uploadRes = savePhotoToDrive(data.photo, data.customerCode, data.userCode);
      photoUrl = uploadRes.url;
      fileId = uploadRes.id;
    } else if (data.photoUrl) {
      photoUrl = data.photoUrl;
    }

    // Chuẩn bị dòng dữ liệu
    var timestamp = new Date();
    var rowData = [
      formatDate(timestamp),                       // A: Thời Gian Lưu
      data.userCode || "",                         // B: Mã Nhân Viên
      data.userName || "",                         // C: Tên Nhân Viên
      data.region || "",                           // D: Vùng / Khu Vực
      data.customerCode || "",                     // E: Mã Khách Hàng
      data.customerName || "",                     // F: Tên Khách Hàng
      data.address || "",                          // G: Địa Chỉ
      data.phone || "",                            // H: Số Điện Thoại
      data.freezerBarcode || data.barcode || "",  // I: Mã Tủ / Serial
      data.freezerModel || "",                     // J: Tên Tủ / Model
      data.freezerQuantity || 1,                   // K: Số Lượng Tủ
      data.workingCondition || "",                 // L: Tình Trạng Tủ
      data.conditionNote || "",                    // M: Ghi Chú Tình Trạng
      data.cleanliness || "",                      // N: Vệ Sinh Tủ
      data.stockCompliance || "",                  // O: Tình Trạng Hàng Hóa
      data.displayLocation || "",                  // P: Vị Trí Trưng Bày
      data.posmStatus || "",                       // Q: POSM / Dán Nhãn
      data.notes || "",                            // R: Ghi Chú Chung
      data.latitude || "",                         // S: Vĩ Độ (Lat)
      data.longitude || "",                        // T: Kinh Độ (Lng)
      data.distanceMeters || "",                   // U: Khoảng Cách (m)
      photoUrl || "Không có ảnh",                  // V: Link Ảnh (Sẽ set RichText link)
      fileId || ""                                 // W: Drive File ID
    ];

    sheet.appendRow(rowData);
    var lastRow = sheet.getLastRow();

    // Gán Hyperlink native chuẩn (không dùng công thức để tránh xung đột dấu phẩy/chấm phẩy)
    if (photoUrl) {
      var richText = SpreadsheetApp.newRichTextValue()
        .setText("🔗 Xem Ảnh Gốc")
        .setLinkUrl(photoUrl)
        .build();
      sheet.getRange(lastRow, 22).setRichTextValue(richText);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Đã lưu dữ liệu kiểm tra và hình ảnh lên Google Sheets thành công!",
      row: lastRow,
      photoUrl: photoUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi xử lý server Apps Script: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Khởi tạo Header chuẩn cho Google Sheet
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
    "Hình Ảnh Bằng Chứng",
    "Drive File ID"
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
  sheet.setColumnWidth(22, 130); // Photo Link
}

/**
 * Lưu ảnh chụp Base64 trực tiếp vào thư mục Google Drive chuyên biệt
 */
function savePhotoToDrive(base64Data, customerCode, userCode) {
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
  var fileName = "AUDIT_" + safeCust + "_" + safeUser + "_" + timeStr + ".jpg";
  
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
