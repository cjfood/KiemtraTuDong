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
  "Thời Gian Kiểm Tra",                         // 1: A
  "Mã Nhân Viên (User)",                        // 2: B
  "Tên Người Kiểm Tra",                         // 3: C
  "Mã Khách Hàng (Mã KH)",                      // 4: D
  "Tên Khách Hàng",                             // 5: E
  "Kênh Bán Hàng",                              // 6: F
  "Tuyến Bán Hàng",                             // 7: G
  "Địa Chỉ Cửa Hàng",                           // 8: H
  "Số Điện Thoại",                              // 9: I
  "NVBH Tuyến",                                 // 10: J
  "SĐT NVBH",                                   // 11: K
  "Mã QR POSM",                                 // 12: L
  "Số Seri Tủ",                                 // 13: M
  "Model Tủ Đông",                              // 14: N
  "1. Tình Trạng Tủ",                           // 15: O
  "2. Tủ Cắm Điện 24/7",                        // 16: P
  "3. Tủ Có Hàng CJ",                           // 17: Q
  "4. Đơn Hàng CJ 30 Ngày",                     // 18: R
  "5. Doanh Số CJ 30 Ngày (VNĐ)",               // 19: S
  "6. Có Bán Hàng Đối Thủ?",                    // 20: T
  "Chi Tiết Đối Thủ",                           // 21: U
  "7. Tiềm Năng Doanh Số / Tháng",              // 22: V
  "8. Thông Tin Điểm Bán",                      // 23: W
  "Chi Tiết Thông Tin Đúng",                    // 24: X
  "9. Loại Hình Điểm Bán",                      // 25: Y
  "10. Phù Hợp Nhóm CJ Mục Tiêu?",              // 26: Z
  "11. Vị Trí Đặt Tủ",                          // 27: AA
  "12. Tần Suất Giao Hàng của NPP / NVBH",      // 28: AB
  "13. Nguyên Nhân Chính Không Lấy Hàng",       // 29: AC
  "14. Nguyên Nhân Chi Tiết & Ý Kiến Điểm Bán", // 30: AD
  "15. Đề Xuất Xử Lý",                          // 31: AE
  "Chi Tiết Đề Xuất Xử Lý",                     // 32: AF
  "16. Ngày Follow-Up (Tái Kiểm Tra)",          // 33: AG
  "Trạng Thái Xử Lý",                           // 34: AH
  "GPS Vĩ Độ (Lat)",                            // 35: AI
  "GPS Kinh Độ (Lng)",                          // 36: AJ
  "Địa Chỉ GPS Thực Địa",                       // 37: AK
  "📸 Link Ảnh Tấm 1: Tủ Đông & Hàng CJ",       // 38: AL
  "📸 Link Ảnh Tấm 2: Toàn Cảnh Điểm Bán",       // 39: AM
  "Google Drive ID (Ảnh 1)",                    // 40: AN
  "Google Drive ID (Ảnh 2)"                     // 41: AO
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

  if (action === "getAssignments") {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName("PhanCong");
      if (!sheet || sheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          total: 0,
          assignments: {}
        })).setMimeType(ContentService.MimeType.JSON);
      }
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
      var assignments = {};
      for (var p = 0; p < rows.length; p++) {
        var r = rows[p];
        var code = String(r[0] || "").trim();
        if (!code) continue;
        assignments[code] = {
          auditorUser: String(r[1] || "").trim(),
          auditorName: String(r[2] || "").trim(),
          updatedAt: String(r[3] || ""),
          assignedBy: String(r[4] || "")
        };
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        total: Object.keys(assignments).length,
        assignments: assignments
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "clearAudits") {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
      var deleted = 0;
      if (sheet && sheet.getLastRow() > 1) {
        deleted = sheet.getLastRow() - 1;
        sheet.deleteRows(2, deleted);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã xóa toàn bộ " + deleted + " dòng dữ liệu kiểm tra cũ trên Google Sheet!",
        deletedRows: deleted
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
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
          qrCode: String(row[11] || "").trim(),
          freezerBarcode: String(row[12] || "").trim(),
          freezerModel: String(row[13] || "").trim(),
          condition: String(row[14] || "").trim(),
          workingCondition: String(row[14] || "").trim(),
          powerStatus: String(row[15] || "").trim(),
          hasCjGoods: String(row[16] || "").trim(),
          orders30d: row[17] || 0,
          sales30d: row[18] || 0,
          hasCompetitor: String(row[19] || "").trim(),
          competitorDetail: String(row[20] || "").trim(),
          revenuePotential: String(row[21] || "").trim(),
          storeInfoStatus: String(row[22] || "").trim(),
          storeInfoDetail: String(row[23] || "").trim(),
          storeType: String(row[24] || "").trim(),
          matchCjTarget: String(row[25] || "").trim(),
          freezerLocation: String(row[26] || "").trim(),
          deliveryFrequency: String(row[27] || "").trim(),
          rootCause: String(row[28] || "").trim(),
          rootCauseDetail: String(row[29] || "").trim(),
          actionProposal: String(row[30] || "").trim(),
          actionProposalDetail: String(row[31] || "").trim(),
          followUpDate: String(row[32] || "").trim(),
          actionStatus: String(row[33] || "").trim(),
          latitude: row[34] || "",
          longitude: row[35] || "",
          gpsAddress: String(row[36] || "").trim(),
          photoPosmUrl: String(row[37] || "").trim(),
          photoOverviewUrl: String(row[38] || "").trim()        });
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

    if (data.action === "saveAssignments" && data.assignments) {
      var ssAssign = SpreadsheetApp.getActiveSpreadsheet();
      var assignSheet = ssAssign.getSheetByName("PhanCong");
      if (!assignSheet) {
        assignSheet = ssAssign.insertSheet("PhanCong");
        var assignHeaders = ["Mã Khách Hàng", "User Kiểm Tra", "Tên Người Kiểm Tra", "Thời Gian Cập Nhật", "Người Phân Bổ"];
        assignSheet.getRange(1, 1, 1, assignHeaders.length).setValues([assignHeaders]);
        assignSheet.getRange(1, 1, 1, assignHeaders.length).setBackground("#184594").setFontColor("#FFFFFF").setFontWeight("bold");
      }
      
      var storeKeys = Object.keys(data.assignments);
      if (storeKeys.length > 0) {
        var existingData = assignSheet.getLastRow() > 1 ? assignSheet.getRange(2, 1, assignSheet.getLastRow() - 1, 1).getValues() : [];
        var rowMap = {};
        for (var ex = 0; ex < existingData.length; ex++) {
          var sCode = String(existingData[ex][0] || "").trim();
          if (sCode) rowMap[sCode] = ex + 2;
        }

        var newRows = [];
        var nowStr = formatDate(new Date());

        for (var k = 0; k < storeKeys.length; k++) {
          var sId = storeKeys[k];
          var aObj = data.assignments[sId];
          if (!aObj) continue;
          var rowVals = [
            sId,
            aObj.auditorUser || "",
            aObj.auditorName || "",
            aObj.updatedAt || nowStr,
            aObj.assignedBy || "admin"
          ];
          if (rowMap[sId]) {
            assignSheet.getRange(rowMap[sId], 1, 1, 5).setValues([rowVals]);
          } else {
            newRows.push(rowVals);
          }
        }
        if (newRows.length > 0) {
          assignSheet.getRange(assignSheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã lưu thông tin phân công thành công!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      var firstSheet = ss.getSheets()[0];
      if (firstSheet && firstSheet.getLastRow() <= 1 && firstSheet.getName() !== SHEET_NAME) {
        firstSheet.setName(SHEET_NAME);
        sheet = firstSheet;
      } else {
        sheet = ss.insertSheet(SHEET_NAME, 0);
      }
      initSheetHeader(sheet);
    } else {
      ensureComprehensiveHeaders(sheet);
    }
    ss.setActiveSheet(sheet);

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
      data.userCode || data.auditorUser || "",                          // 2: Mã Nhân Viên (User)
      data.userName || data.auditorName || "",                          // 3: Tên Người Kiểm Tra
      data.customerCode || data.storeCode || data.storeId || "",        // 4: Mã Khách Hàng (Mã KH)
      data.customerName || data.storeName || "",                        // 5: Tên Khách Hàng
      data.channel || "GT",                                             // 6: Kênh Bán Hàng
      data.route || "",                                                 // 7: Tuyến Bán Hàng
      data.address || "",                                               // 8: Địa Chỉ Cửa Hàng
      data.phone || "",                                                 // 9: Số Điện Thoại
      data.salesRep || "",                                              // 10: NVBH Tuyến
      data.salesRepPhone || "",                                         // 11: SĐT NVBH
      data.qrCode || "",                                                // 12: Mã QR POSM
      data.freezerBarcode || data.barcode || data.freezerId || "",      // 13: Số Seri Tủ
      data.freezerModel || data.model || "",                            // 14: Model Tủ Đông
      data.condition || data.workingCondition || "Bình thường",         // 15: 1. Tình Trạng Tủ
      data.powerStatus || "",                                           // 16: 2. Tủ Cắm Điện 24/7
      data.hasCjGoods || "",                                            // 17: 3. Tủ Có Hàng CJ
      data.orders30d !== undefined ? data.orders30d : "",               // 18: 4. Đơn Hàng CJ 30 Ngày
      data.sales30d !== undefined ? data.sales30d : "",                 // 19: 5. Doanh Số CJ 30 Ngày (VNĐ)
      data.hasCompetitor || "",                                         // 20: 6. Có Bán Hàng Đối Thủ?
      data.competitorDetail || "",                                      // 21: Chi Tiết Đối Thủ
      data.revenuePotential || "",                                      // 22: 7. Tiềm Năng Doanh Số / Tháng
      data.storeInfoStatus || "Đúng thông tin KH",                      // 23: 8. Thông Tin Điểm Bán
      data.storeInfoDetail || "",                                       // 24: Chi Tiết Thông Tin Đúng
      data.storeType || "",                                             // 25: 9. Loại Hình Điểm Bán
      data.matchCjTarget || "",                                         // 26: 10. Phù Hợp Nhóm CJ Mục Tiêu?
      data.freezerLocation || "",                                       // 27: 11. Vị Trí Đặt Tủ
      data.deliveryFrequency || "",                                     // 28: 12. Tần Suất Giao Hàng của NPP / NVBH
      data.rootCause || "",                                             // 29: 13. Nguyên Nhân Chính Không Lấy Hàng
      data.rootCauseDetail || "",                                       // 30: 14. Nguyên Nhân Chi Tiết & Ý Kiến Điểm Bán
      data.actionProposal || "",                                        // 31: 15. Đề Xuất Xử Lý
      data.actionProposalDetail || "",                                  // 32: Chi Tiết Đề Xuất Xử Lý
      data.followUpDate || "",                                          // 33: 16. Ngày Follow-Up (Tái Kiểm Tra)
      data.actionStatus || "Chờ xử lý",                                 // 34: Trạng Thái Xử Lý
      data.latitude || (data.photoMetadata ? data.photoMetadata.lat : "") || "",  // 35: GPS Vĩ Độ (Lat)
      data.longitude || (data.photoMetadata ? data.photoMetadata.lng : "") || "", // 36: GPS Kinh Độ (Lng)
      data.gpsAddress || (data.photoMetadata ? data.photoMetadata.address : "") || data.address || "", // 37: Địa Chỉ GPS Thực Địa
      photoPosmUrl || "Không có ảnh",                                   // 38: 📸 Link Ảnh Tấm 1: Tủ Đông & Hàng CJ
      photoOverviewUrl || "Không có ảnh",                               // 39: 📸 Link Ảnh Tấm 2: Toàn Cảnh Điểm Bán
      fileIdPosm || "",                                                 // 40: Google Drive ID (Ảnh 1)
      fileIdOverview || ""                                              // 41: Google Drive ID (Ảnh 2)
    ];

    sheet.appendRow(rowData);
    var lastRow = sheet.getLastRow();

    // Hyperlink chuẩn Google Sheets mở trực tiếp ảnh trên Google Drive
    if (photoPosmUrl && photoPosmUrl.indexOf("http") === 0) {
      var richTextPosm = SpreadsheetApp.newRichTextValue()
        .setText("🔗 Xem Ảnh Tủ Đông (GPS)")
        .setLinkUrl(photoPosmUrl)
        .build();
      sheet.getRange(lastRow, 38).setRichTextValue(richTextPosm);
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
    // Luôn ghi đè cập nhật dòng tiêu đề 1 khớp chính xác 100% với form khảo sát mới nhất của App
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#c62828")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center")
               .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 38);
    sheet.setFrozenRows(1);
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
