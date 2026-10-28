/**
 * =========================================================================
 * CJ CAU TRE / CJ FOODS VIETNAM - MARKET AUDIT SYSTEM
 * GOOGLE APPS SCRIPT BACKEND (GOOGLE SHEETS & GOOGLE DRIVE)
 * BẢNG TỔNG HỢP KIỂM TRA THỊ TRƯỜNG & TỦ ĐÔNG ĐẦY ĐỦ THÔNG TIN
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

var HEADERS = [
  "Thời Gian Kiểm Tra",              // 1: A
  "Mã Nhân Viên (User)",             // 2: B
  "Tên Người Kiểm Tra",              // 3: C
  "Mã Khách Hàng (Mã KH)",           // 4: D
  "Tên Khách Hàng",                  // 5: E
  "Kênh Bán Hàng",                   // 6: F
  "Tuyến Bán Hàng",                  // 7: G
  "Địa Chỉ Cửa Hàng",                // 8: H
  "Số Điện Thoại",                   // 9: I
  "NVBH Tuyến",                      // 10: J
  "SĐT NVBH",                        // 11: K
  "Mã Tủ / Barcode / Serial",        // 12: L
  "Model Tủ Đông",                   // 13: M
  "1. Tình Trạng Tủ",                // 14: N
  "2. Tủ Cắm Điện 24/7",             // 15: O
  "3. Tủ Có Hàng CJ",                // 16: P
  "4. Đơn Hàng CJ 30 Ngày",          // 17: Q
  "5. Doanh Số CJ 30 Ngày (VNĐ)",    // 18: R
  "6. Có Bán Hàng Đối Thủ",          // 19: S
  "Chi Tiết Hàng Đối Thủ",           // 20: T
  "7. Tiềm Năng Doanh Số / Tháng",   // 21: U
  "8. Loại Hình Cửa Hàng",           // 22: V
  "9. Ngành Hàng Kinh Doanh",        // 23: W
  "10. Phù Hợp Định Hướng CJ",       // 24: X
  "11. Vị Trí Đặt Tủ",               // 25: Y
  "12. Độ Nhận Diện Tủ",             // 26: Z
  "13. Tuyến Có Xe Tải Giao",        // 27: AA
  "14. Tần Suất Giao Của NPP / NVBH",// 28: AB
  "15. Nguyên Nhân Không Lấy Hàng",  // 29: AC
  "Chi Tiết Nguyên Nhân",            // 30: AD
  "17. Đề Xuất Xử Lý",               // 31: AE
  "18. PIC Hành Động",               // 32: AF
  "19. Hạn Hoàn Thành (Deadline)",   // 33: AG
  "20. Trạng Thái Xử Lý",            // 34: AH
  "22. Kết Quả Sau Xử Lý",           // 35: AI
  "23. Ngày Follow-Up",              // 36: AJ
  "GPS Vĩ Độ (Lat)",                 // 37: AK
  "GPS Kinh Độ (Lng)",               // 38: AL
  "📸 Link Ảnh Kiểm Tra Tủ Đông",    // 39: AM
  "📸 Link Ảnh Tổng Quan Cửa Hàng",  // 40: AN
  "Drive ID (Tủ Đông)",              // 41: AO
  "Drive ID (Tổng Quan)"             // 42: AP
];

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getAudits";
  
  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Kết nối hệ thống Google Sheets & Drive CJ Foods Vietnam thành công!",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "getAudits" || !action) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          total: 0,
          audits: []
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          total: 0,
          audits: []
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var maxCols = Math.min(HEADERS.length, sheet.getLastColumn());
      var data = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
      var audits = [];
      
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!row[0] && !row[1] && !row[3] && !row[11]) continue;
        
        var timeVal = row[0];
        var timeStr = (timeVal instanceof Date) ? formatDate(timeVal) : String(timeVal || "");
        
        audits.push({
          timestamp: timeStr,
          userCode: String(row[1] || "").trim(),
          userName: String(row[2] || "").trim(),
          customerCode: String(row[3] || "").trim(),
          customerName: String(row[4] || "").trim(),
          channel: String(row[5] || "GT").trim(),
          route: String(row[6] || "").trim(),
          address: String(row[7] || "").trim(),
          phone: String(row[8] || "").trim(),
          salesRep: String(row[9] || "").trim(),
          salesRepPhone: String(row[10] || "").trim(),
          freezerBarcode: String(row[11] || "").trim(),
          freezerModel: String(row[12] || "").trim(),
          workingCondition: String(row[13] || "").trim(),
          condition: String(row[13] || "").trim(),
          powerStatus: String(row[14] || "").trim(),
          hasCjGoods: String(row[15] || "").trim(),
          orders30d: row[16] || 0,
          sales30d: row[17] || 0,
          hasCompetitor: String(row[18] || "").trim(),
          competitorDetail: String(row[19] || "").trim(),
          revenuePotential: String(row[20] || "").trim(),
          storeType: String(row[21] || "").trim(),
          businessCategory: String(row[22] || "").trim(),
          matchCjTarget: String(row[23] || "").trim(),
          freezerLocation: String(row[24] || "").trim(),
          freezerVisibility: String(row[25] || "").trim(),
          truckAccessible: String(row[26] || "").trim(),
          deliveryFrequency: String(row[27] || "").trim(),
          rootCause: String(row[28] || "").trim(),
          rootCauseDetail: String(row[29] || "").trim(),
          actionProposal: String(row[30] || "").trim(),
          actionPic: String(row[31] || "").trim(),
          deadline: String(row[32] || "").trim(),
          actionStatus: String(row[33] || "").trim(),
          actionResult: String(row[34] || "").trim(),
          followUpDate: String(row[35] || "").trim(),
          latitude: row[36] || "",
          longitude: row[37] || "",
          photoPosmUrl: String(row[38] || "").trim(),
          photoOverviewUrl: String(row[39] || "").trim()
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        total: audits.length,
        audits: audits
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Lỗi đọc dữ liệu Google Sheets: " + err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "CJ Market Audit Web Service is active"
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

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      initSheetHeader(sheet);
    } else {
      ensureComprehensiveHeaders(sheet);
    }

    // 1. Lưu ảnh 1: Tủ đông (Watermark GPS)
    var photoPosmBase64 = data.photoPosm || data.photo || data.photoUrl || "";
    var photoPosmUrl = "";
    var fileIdPosm = "";
    if (photoPosmBase64 && photoPosmBase64.indexOf("data:image") !== -1) {
      var uploadResPosm = savePhotoToDrive(photoPosmBase64, data.customerCode || data.storeCode, data.userCode, "TUDONG");
      photoPosmUrl = uploadResPosm.url;
      fileIdPosm = uploadResPosm.id;
    } else if (data.photoPosmUrl || (data.photoUrl && data.photoUrl.indexOf("http") === 0)) {
      photoPosmUrl = data.photoPosmUrl || data.photoUrl;
    }

    // 2. Lưu ảnh 2: Tổng quan cửa hàng
    var photoOverviewBase64 = data.photoOverview || "";
    var photoOverviewUrl = "";
    var fileIdOverview = "";
    if (photoOverviewBase64 && photoOverviewBase64.indexOf("data:image") !== -1) {
      var uploadResOv = savePhotoToDrive(photoOverviewBase64, data.customerCode || data.storeCode, data.userCode, "TONGQUAN");
      photoOverviewUrl = uploadResOv.url;
      fileIdOverview = uploadResOv.id;
    } else if (data.photoOverviewUrl && data.photoOverviewUrl.indexOf("http") === 0) {
      photoOverviewUrl = data.photoOverviewUrl;
    }

    // Dòng dữ liệu đầy đủ 42 cột chuẩn mực FMCG RTM
    var timestamp = new Date();
    var rowData = [
      formatDate(timestamp),                                            // 1: Thời Gian Kiểm Tra
      data.userCode || data.auditorUser || "",                          // 2: Mã NV Kiểm Tra
      data.userName || data.auditorName || "",                          // 3: Tên Người Kiểm Tra
      data.customerCode || data.storeCode || data.storeId || "",        // 4: Mã Khách Hàng
      data.customerName || data.storeName || "",                        // 5: Tên Khách Hàng
      data.channel || "GT",                                             // 6: Kênh Bán Hàng
      data.route || "",                                                 // 7: Tuyến Bán Hàng
      data.address || "",                                               // 8: Địa Chỉ
      data.phone || "",                                                 // 9: Số Điện Thoại
      data.salesRep || "",                                              // 10: NVBH Tuyến
      data.salesRepPhone || "",                                         // 11: SĐT NVBH
      data.freezerBarcode || data.barcode || data.freezerId || "",      // 12: Mã Tủ / Serial
      data.freezerModel || data.model || "",                            // 13: Model Tủ
      data.condition || data.workingCondition || "Bình thường",         // 14: 1. Tình Trạng Tủ
      data.powerStatus || "",                                           // 15: 2. Tủ Cắm Điện 24/7
      data.hasCjGoods || "",                                            // 16: 3. Tủ Có Hàng CJ
      data.orders30d !== undefined ? data.orders30d : "",               // 17: 4. Đơn Hàng CJ 30 Ngày
      data.sales30d !== undefined ? data.sales30d : "",                 // 18: 5. Doanh Số CJ 30 Ngày
      data.hasCompetitor || "",                                         // 19: 6. Có Bán Hàng Đối Thủ
      data.competitorDetail || "",                                      // 20: Chi Tiết Đối Thủ
      data.revenuePotential || "",                                      // 21: 7. Tiềm Năng Doanh Số
      data.storeType || "",                                             // 22: 8. Loại Hình Cửa Hàng
      data.businessCategory || "",                                      // 23: 9. Ngành Hàng Kinh Doanh
      data.matchCjTarget || "",                                         // 24: 10. Phù Hợp Định Hướng CJ
      data.freezerLocation || "",                                       // 25: 11. Vị Trí Đặt Tủ
      data.freezerVisibility || "",                                     // 26: 12. Độ Nhận Diện Tủ
      data.truckAccessible || "",                                       // 27: 13. Tuyến Có Xe Tải Giao
      data.deliveryFrequency || "",                                     // 28: 14. Tần Suất Giao Của NPP / NVBH
      data.rootCause || "",                                             // 29: 15. Nguyên Nhân Không Lấy Hàng
      data.rootCauseDetail || "",                                       // 30: Chi Tiết Nguyên Nhân
      data.actionProposal || "",                                        // 31: 17. Đề Xuất Xử Lý
      data.actionPic || "",                                             // 32: 18. PIC Hành Động
      data.deadline || "",                                              // 33: 19. Hạn Hoàn Thành
      data.actionStatus || "Chờ xử lý",                                 // 34: 20. Trạng Thái Xử Lý
      data.actionResult || "",                                          // 35: 22. Kết Quả Sau Xử Lý
      data.followUpDate || "",                                          // 36: 23. Ngày Follow-Up
      data.latitude || (data.photoMetadata ? data.photoMetadata.lat : "") || "",  // 37: Vĩ Độ
      data.longitude || (data.photoMetadata ? data.photoMetadata.lng : "") || "", // 38: Kinh Độ
      photoPosmUrl || "Không có ảnh",                                   // 39: Link Ảnh Tủ Đông
      photoOverviewUrl || "Không có ảnh",                               // 40: Link Ảnh Tổng Quan
      fileIdPosm || "",                                                 // 41: Drive ID Tủ Đông
      fileIdOverview || ""                                              // 42: Drive ID Tổng Quan
    ];

    sheet.appendRow(rowData);
    var lastRow = sheet.getLastRow();

    // Hyperlink chuẩn Google Sheets mở trực tiếp ảnh trên Google Drive
    if (photoPosmUrl && photoPosmUrl.indexOf("http") === 0) {
      var richTextPosm = SpreadsheetApp.newRichTextValue()
        .setText("🔗 Xem Ảnh Tủ Đông (GPS)")
        .setLinkUrl(photoPosmUrl)
        .build();
      sheet.getRange(lastRow, 39).setRichTextValue(richTextPosm);
    }

    if (photoOverviewUrl && photoOverviewUrl.indexOf("http") === 0) {
      var richTextOv = SpreadsheetApp.newRichTextValue()
        .setText("🔗 Xem Ảnh Tổng Quan CH")
        .setLinkUrl(photoOverviewUrl)
        .build();
      sheet.getRange(lastRow, 40).setRichTextValue(richTextOv);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Đã lưu thành công dữ liệu kiểm tra và hình ảnh lên Google Sheets & Drive!",
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

function initSheetHeader(sheet) {
  sheet.appendRow(HEADERS);
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground("#c62828") // CJ Brand Red
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
  
  // Thiết lập độ rộng cột tối ưu
  sheet.setColumnWidth(1, 150); // Thời gian
  sheet.setColumnWidth(2, 100); // User
  sheet.setColumnWidth(3, 140); // Tên người kiểm
  sheet.setColumnWidth(4, 110); // Mã KH
  sheet.setColumnWidth(5, 220); // Tên KH
  sheet.setColumnWidth(6, 80);  // Kênh
  sheet.setColumnWidth(7, 100); // Tuyến
  sheet.setColumnWidth(8, 260); // Địa chỉ
  sheet.setColumnWidth(9, 110); // SĐT
  sheet.setColumnWidth(10, 140); // NVBH
  sheet.setColumnWidth(11, 110); // SĐT NVBH
  sheet.setColumnWidth(12, 130); // Barcode
  sheet.setColumnWidth(13, 160); // Model
  sheet.setColumnWidth(14, 150); // Tình trạng tủ
  sheet.setColumnWidth(39, 180); // Ảnh Tủ Đông
  sheet.setColumnWidth(40, 180); // Ảnh Tổng Quan
}

function ensureComprehensiveHeaders(sheet) {
  try {
    var curCols = sheet.getLastColumn();
    if (curCols < HEADERS.length) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
      headerRange.setBackground("#c62828")
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center")
                 .setVerticalAlignment("middle");
      sheet.setRowHeight(1, 38);
      sheet.setFrozenRows(1);
    }
  } catch (e) {
    console.warn("Lỗi đồng bộ headers:", e);
  }
}

function getOrCreatePhotoFolder() {
  try {
    var ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    var ssFile = DriveApp.getFileById(ssId);
    var parentFolders = ssFile.getParents();
    var parentFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
    
    // Tự động tìm hoặc tạo thư mục con NGAY BÊN TRONG thư mục chứa file Google Sheet này
    var subFolders = parentFolder.getFoldersByName(FOLDER_NAME);
    if (subFolders.hasNext()) {
      return subFolders.next();
    } else {
      var folder = parentFolder.createFolder(FOLDER_NAME);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return folder;
    }
  } catch (e) {
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) return folders.next();
    var fallback = DriveApp.createFolder(FOLDER_NAME);
    fallback.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return fallback;
  }
}

function savePhotoToDrive(base64Data, customerCode, userCode, typeTag) {
  var folder = getOrCreatePhotoFolder();

  var base64String = base64Data;
  if (base64Data.indexOf(",") !== -1) {
    base64String = base64Data.split(",")[1];
  }
  
  var decoded = Utilities.base64Decode(base64String);
  var timeStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
  var safeCust = (customerCode || "OUTLET").replace(/[^a-zA-Z0-9_-]/g, "");
  var safeUser = (userCode || "NVBH").replace(/[^a-zA-Z0-9_-]/g, "");
  var prefix = typeTag ? (typeTag + "_") : "AUDIT_";
  var fileName = prefix + safeCust + "_" + safeUser + "_" + timeStr + ".jpg";
  
  var blob = Utilities.newBlob(decoded, "image/jpeg", fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var viewUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";
  
  return {
    url: viewUrl,
    id: file.getId()
  };
}

function formatDate(date) {
  return Utilities.formatDate(date, "GMT+7", "yyyy-MM-dd HH:mm:ss");
}
