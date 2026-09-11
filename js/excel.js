/**
 * CJ MarketAudit - Excel Export & Import Engine
 * Generates official DMS / RTM report format & Bulk Customer/Freezer Import
 */

const CJExcel = {
  /**
   * Export comprehensive 3-sheet audit report with user filtering support
   */
  exportAuditReport(targetUser = null) {
    if (typeof XLSX === "undefined") {
      alert("Thư viện SheetJS chưa được tải!");
      return;
    }

    const currentUser = CJAuth.getCurrentUser();
    // Determine effective target user: explicit targetUser passed, or currentUser
    let effectiveUser = targetUser;
    if (!effectiveUser) {
      effectiveUser = CJAuth.isAdmin() ? "ALL" : (currentUser ? currentUser.username : "ALL");
    }

    const audits = CJStorage.getAuditsForUser(effectiveUser);
    const stores = CJStorage.getStoresForUser(effectiveUser);
    const freezers = CJStorage.getFreezers();
    const tickets = CJStorage.getTickets();

    // 1. Prepare Sheet 1: Audit Log
    const auditDataRows = audits.map((a, idx) => ({
      "STT": idx + 1,
      "Mã Audit": a.id,
      "Thời Gian": a.auditTime,
      "Mã Điểm Bán": a.storeId,
      "Tên Điểm Bán": a.storeName,
      "Kênh": a.channel,
      "Tài Khoản Sales": a.auditorUser || "N/A",
      "Nhân Viên Kiểm Tra": a.auditorName,
      "Chức Vụ": a.auditRole,
      "Mã Tài Sản Tủ": a.assetTag,
      "Cắm Điện": a.isPowered ? "CÓ" : "KHÔNG (RÚT)",
      "Nhiệt Độ (°C)": a.temperature,
      "Đánh Giá Nhiệt Độ": a.tempStatus === "pass" ? "ĐẠT (<= -18°C)" : a.tempStatus === "warning" ? "CẢNH BÁO" : "NGUY HIỂM (> -10°C)",
      "Đóng Tuyết": a.frostCondition === "none" ? "Không" : a.frostCondition === "normal" ? "Bình thường" : "Dày (cần xả)",
      "Decal Bibigo/Cầu Tre": a.decalCondition,
      "Tình Trạng Thiết Bị": a.physicalCondition,
      "Tỷ Lệ SOS CJ Foods (%)": a.sosCJ,
      "Đối Thủ Trà Trộn": a.competitorsFound ? a.competitorsFound.join(", ") : "",
      "Vệ Sinh Tủ": a.cleanliness === "clean" ? "Sạch sẽ" : "Bẩn/Mùi hôi",
      "Điểm Đánh Giá": a.score,
      "Xếp Hạng": a.rating,
      "Ghi Chú & Sự Cố": a.issuesNotes || "",
      "Hành Động Khắc Phục": a.actionRequired || "",
      "Có Ticket Kỹ Thuật": a.ticketCreated ? "CÓ" : "KHÔNG",
      "Mã Ticket": a.ticketDetails ? a.ticketDetails.ticketId : "",
      "Tọa Độ GPS (Lat,Lng)": a.gps ? `${a.gps.lat}, ${a.gps.lng}` : ""
    }));

    // 2. Prepare Sheet 2: Freezers & Assigned Store Master
    const storeIds = new Set(stores.map(s => s.id));
    const freezerRows = freezers
      .filter(f => !currentUser || CJAuth.isAdmin() || storeIds.has(f.assignedStoreId))
      .map((f, idx) => {
        const store = CJStorage.getStoreById(f.assignedStoreId);
        return {
          "STT": idx + 1,
          "Mã Tài Sản": f.assetTag,
          "Thương Hiệu": f.brandAssigned,
          "Model Tủ": f.model,
          "Dung Tích": f.capacity,
          "Số Serial": f.serialNumber,
          "Ngày Cấp": f.installationDate,
          "Điểm Bán Hiện Tại": store ? store.name : "Kho CJ",
          "Mã Điểm Bán": f.assignedStoreId || "",
          "Kênh Phân Phối": store ? store.channel : "",
          "Sales Phụ Trách": store ? `${store.salesRep} (${store.assignedUser})` : "",
          "Nhiệt Độ Gần Nhất (°C)": f.lastTemperature,
          "Trạng Thái Tủ": f.status === "good" ? "Hoạt động tốt" : f.status === "warning" ? "Cảnh báo" : "Sự cố nguy cấp"
        };
      });

    // 3. Prepare Sheet 3: Maintenance Tickets
    const ticketRows = tickets.map((t, idx) => ({
      "STT": idx + 1,
      "Mã Ticket": t.ticketId,
      "Điểm Bán": t.storeName,
      "Mã Cửa Hàng": t.storeId,
      "Mã Tủ Đông": t.assetTag,
      "Mức Độ Ưu Tiên": t.priority,
      "Nội Dung Sự Cố": t.issueType,
      "Đơn Vị Xử Lý": t.assignedTo,
      "Trạng Thái": t.status === "OPEN" ? "Chờ xử lý" : t.status === "IN_PROGRESS" ? "Đang xử lý" : "Đã hoàn thành",
      "Thời Gian Tạo": t.createdAt
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    const wsAudits = XLSX.utils.json_to_sheet(auditDataRows);
    const wsFreezers = XLSX.utils.json_to_sheet(freezerRows);
    const wsTickets = XLSX.utils.json_to_sheet(ticketRows);

    const setColWidths = (ws, rows) => {
      if (!rows.length) return;
      const keys = Object.keys(rows[0]);
      ws["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 4, 14) }));
    };

    setColWidths(wsAudits, auditDataRows);
    setColWidths(wsFreezers, freezerRows);
    setColWidths(wsTickets, ticketRows);

    XLSX.utils.book_append_sheet(wb, wsAudits, "BaoCao_KiemTra_TuDong");
    XLSX.utils.book_append_sheet(wb, wsFreezers, "DanhMuc_TuDong_CJ");
    XLSX.utils.book_append_sheet(wb, wsTickets, "Ticket_SuaChua");

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const userPrefix = currentUser ? `_${currentUser.username}` : "";
    const fileName = `CJFoods_BaoCao_KiemTra_TuDong_${dateStr}${userPrefix}.xlsx`;

    XLSX.writeFile(wb, fileName);
    CJAudit.showToast(`Đã xuất báo cáo Excel: ${fileName}`, "success");
  },

  /**
   * Export complete Customers / Outlets list to Excel (.xlsx) file
   */
  exportStoresToExcel(targetUser = null) {
    if (typeof XLSX === "undefined") {
      alert("Thư viện SheetJS chưa được tải!");
      return;
    }

    const currentUser = (typeof CJAuth !== "undefined" && CJAuth.getCurrentUser) ? CJAuth.getCurrentUser() : null;
    let effectiveUser = targetUser;
    if (!effectiveUser) {
      if (typeof CJAuth !== "undefined" && CJAuth.isAdmin()) {
        effectiveUser = (typeof CJApp !== "undefined" && CJApp.adminControlledUser) ? CJApp.adminControlledUser : "ALL";
      } else {
        effectiveUser = currentUser ? currentUser.username : "ALL";
      }
    }

    // Retrieve stores for effectiveUser
    const stores = (typeof CJStorage !== "undefined" && CJStorage.getStoresForUser) 
      ? CJStorage.getStoresForUser(effectiveUser) 
      : [];

    if (!stores || stores.length === 0) {
      alert("Không có dữ liệu điểm bán nào để xuất!");
      return;
    }

    const freezers = (typeof CJStorage !== "undefined" && CJStorage.getFreezers) 
      ? CJStorage.getFreezers() 
      : [];
    const freezerMap = new Map();
    freezers.forEach(f => {
      if (f.assignedStoreId) freezerMap.set(f.assignedStoreId, f);
      if (f.assetTag) freezerMap.set(f.assetTag, f);
      if (f.serialNumber) freezerMap.set(f.serialNumber, f);
    });

    const exportRows = stores.map((s, idx) => {
      const f = freezerMap.get(s.id) || freezerMap.get(s.freezerId) || freezerMap.get(s.barcode) || {};
      
      const freezerCode = s.freezerId || s.barcode || f.assetTag || "";
      const model = s.model || s.modelTu || s.freezerModel || f.model || "";
      const capacity = s.capacity || f.capacity || "";
      const serial = s.serialNumber || f.serialNumber || "";

      return {
        "STT": idx + 1,
        "User": s.gsbhUsername || s.assignedGsbh || (effectiveUser !== "ALL" ? effectiveUser : "admin"),
        "Ten_user": s.gsbhName || "",
        "Ma_KH": s.storeCode || s.id || "",
        "Ten_KH": s.originalStoreName || s.name || "",
        "Dia_Chi": s.address || "",
        "So_Dien_Thoai": s.phone || "",
        "Kenh": s.channel || "GT",
        "Tuyen_Ban_Hang": s.route || "",
        "Ma_NVBH": s.salesRepCode || "",
        "Ten_NVBH": s.salesRep || "",
        "Ma_Tu_Dong": freezerCode,
        "Model_Tu": model,
        "Dung_Tich": capacity,
        "So_Serial": serial,
        "Vi_Do_Lat": s.lat || "",
        "Kinh_Do_Lon": s.lng || "",
        "Trang_Thai_Kiem_Tra": s.lastAuditDate ? "Đã kiểm tra" : "Chưa kiểm tra",
        "Nhiet_Do_Gan_Nhat": s.lastTemp !== undefined && s.lastTemp !== null ? (s.lastTemp + "°C") : "",
        "Ngay_Kiem_Tra_Gan_Nhat": s.lastAuditDate || ""
      };
    });

    const wb = XLSX.utils.book_new();
    const wsStores = XLSX.utils.json_to_sheet(exportRows);

    // Auto widths
    const keys = Object.keys(exportRows[0]);
    wsStores["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 4, 15) }));

    const sheetName = effectiveUser === "ALL" ? "DS_KhachHang_ToanQuoc" : `DS_KH_${effectiveUser}`;
    XLSX.utils.book_append_sheet(wb, wsStores, sheetName.substring(0, 31));

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const scopeLabel = effectiveUser === "ALL" ? "ToanQuoc" : effectiveUser;
    const filename = `CJFoods_DanhSach_KhachHang_${scopeLabel}_${yyyy}${mm}${dd}.xlsx`;

    XLSX.writeFile(wb, filename);

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast(`✅ Đã xuất thành công ${exportRows.length} khách hàng ra file Excel: ${filename}`, "success");
    } else {
      alert(`✅ Đã xuất thành công ${exportRows.length} khách hàng ra file Excel!`);
    }
  },

  /**
   * Download Excel Template for importing Stores and Freezers
   */
  downloadImportTemplate() {
    if (typeof XLSX === "undefined") {
      alert("Thư viện SheetJS chưa được tải!");
      return;
    }

    // Standardized sample rows matching EXACTLY the user's template (14 columns)
    const sampleRows = [
      {
        "User": "gsbh.bao",
        "Ten_user": "Trần Quốc Bảo",
        "Ma_KH": "STR-GT-013",
        "Ten_KH": "Tạp Hóa Hương Sen (Bình Thạnh)",
        "Dia_Chi": "215 Nơ Trang Long, Phường 12, Q. Bình Thạnh, TP.HCM",
        "So_Dien_Thoai": "0903 888 111",
        "Ma_NVBH": "NV01",
        "Ten_NVBH": "Nguyễn Văn Hùng",
        "Ma_Tu_Dong": "TDOSNK330",
        "Model_Tu": "Tủ đông SANAKY 330L",
        "Dung_Tich": "330L",
        "So_Serial": "TDO03097",
        "Vi_Do_Lat": 10.81425,
        "Kinh_Do_Lon": 106.69832
      },
      {
        "User": "gsbh.bao",
        "Ten_user": "Trần Quốc Bảo",
        "Ma_KH": "STR-GT-014",
        "Ten_KH": "Đại Lý Bách Hóa Hoàng Mai (Gò Vấp)",
        "Dia_Chi": "55 Thống Nhất, Phường 11, Q. Gò Vấp, TP.HCM",
        "So_Dien_Thoai": "0912 334 999",
        "Ma_NVBH": "NV01",
        "Ten_NVBH": "Nguyễn Văn Hùng",
        "Ma_Tu_Dong": "TDOALK550",
        "Model_Tu": "Tủ đông ALASKA 550L",
        "Dung_Tich": "550L",
        "So_Serial": "TDO01092",
        "Vi_Do_Lat": 10.8421,
        "Kinh_Do_Lon": 106.6658
      },
      {
        "User": "gsbh.tung",
        "Ten_user": "Nguyễn Thanh Tùng",
        "Ma_KH": "STR-GT-015",
        "Ten_KH": "Tạp Hóa Út Lượm (Tân Bình)",
        "Dia_Chi": "480 Trường Chinh, Phường 13, Q. Tân Bình, TP.HCM",
        "So_Dien_Thoai": "0908 777 222",
        "Ma_NVBH": "NV03",
        "Ten_NVBH": "Trần Văn Đức",
        "Ma_Tu_Dong": "TDOSNK330",
        "Model_Tu": "Tủ đông SANAKY 330L",
        "Dung_Tich": "330L",
        "So_Serial": "TDO02965",
        "Vi_Do_Lat": 10.8035,
        "Kinh_Do_Lon": 106.6452
      },
      {
        "User": "gsbh.tung",
        "Ten_user": "Nguyễn Thanh Tùng",
        "Ma_KH": "STR-GT-016",
        "Ten_KH": "Cửa Hàng Thực Phẩm Cô Sáu (Quận 7)",
        "Dia_Chi": "72 Huỳnh Tấn Phát, Tân Thuận Tây, Quận 7, TP.HCM",
        "So_Dien_Thoai": "0938 111 555",
        "Ma_NVBH": "NV04",
        "Ten_NVBH": "Vũ Anh Tuấn",
        "Ma_Tu_Dong": "TDOALK210",
        "Model_Tu": "Tủ đông ALASKA 210L",
        "Dung_Tich": "210L",
        "So_Serial": "HTI00310",
        "Vi_Do_Lat": 10.7456,
        "Kinh_Do_Lon": 106.7289
      },
      {
        "User": "gsbh.nam",
        "Ten_user": "Lê Hoàng Nam",
        "Ma_KH": "STR-GT-017",
        "Ten_KH": "Đại Lý Nông Sản Tiền Giang (Mỹ Tho)",
        "Dia_Chi": "15 Ấp Bắc, Phường 4, TP. Mỹ Tho, Tiền Giang",
        "So_Dien_Thoai": "0907 444 888",
        "Ma_NVBH": "NV05",
        "Ten_NVBH": "Huỳnh Minh Hải",
        "Ma_Tu_Dong": "TDOSNK330",
        "Model_Tu": "Tủ đông SANAKY 330L",
        "Dung_Tich": "330L",
        "So_Serial": "TDO02750",
        "Vi_Do_Lat": 10.3582,
        "Kinh_Do_Lon": 106.3564
      }
    ];

    const wb = XLSX.utils.book_new();
    const wsSample = XLSX.utils.json_to_sheet(sampleRows);

    // Auto widths
    const setColWidths = (ws, rows) => {
      if (!rows || !rows.length) return;
      const keys = Object.keys(rows[0]);
      ws["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 4, 14) }));
    };
    setColWidths(wsSample, sampleRows);

    XLSX.utils.book_append_sheet(wb, wsSample, "DanhSach_KhachHang_TuDong");

    XLSX.writeFile(wb, "CJFoods_Mau_Import_DiemBan_TuDong.xlsx");
    CJAudit.showToast("Đã tải file Excel mẫu chuẩn 14 cột theo yêu cầu!", "success");
  },

  /**
   * Process uploaded Excel file with optional targetUser assignment
   */
  async processExcelUpload(file, targetUserOverride = "AUTO", replaceAll = false) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("Chưa chọn file Excel"));

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Read the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          if (!rows || rows.length === 0) {
            return reject(new Error("File Excel không có dữ liệu!"));
          }

          const result = CJStorage.importBulkStoresAndFreezers(rows, targetUserOverride, replaceAll);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Download standard User Import Excel Template conforming to FMCG / DMS structure
   */
  downloadUserImportTemplate() {
    if (typeof XLSX === "undefined") {
      alert("Thư viện SheetJS chưa sẵn sàng!");
      return;
    }

    const sampleUsers = [
      {
        "Tai_Khoan": "gsbh.bao",
        "Ma_NV": "CJ1330714",
        "Ho_Va_Ten": "Trần Quốc Bảo",
        "Mat_Khau": "123",
        "Vai_Tro": "GSBH",
        "Kenh": "GT",
        "Khu_Vuc": "KV TP.HCM 1 (Bình Thạnh, Gò Vấp, Q.4, Phú Nhuận)",
        "So_Dien_Thoai": "0909 999 888",
        "Email": "bao.tq@cjfoods.vn",
        "Nguoi_Quan_Ly": "",
        "Tuyen_Ban_Hang": ""
      },
      {
        "Tai_Khoan": "sale.hung",
        "Ma_NV": "NV01",
        "Ho_Va_Ten": "Nguyễn Văn Hùng",
        "Mat_Khau": "123",
        "Vai_Tro": "NVBH",
        "Kenh": "GT",
        "Khu_Vuc": "Bình Thạnh & Gò Vấp",
        "So_Dien_Thoai": "0903 123 456",
        "Email": "hung.nv@cjfoods.vn",
        "Nguoi_Quan_Ly": "gsbh.bao",
        "Tuyen_Ban_Hang": "Tuyến Thứ 2-4-6 (Bình Thạnh & Gò Vấp)"
      },
      {
        "Tai_Khoan": "sale.tri",
        "Ma_NV": "NV02",
        "Ho_Va_Ten": "Lê Minh Trí",
        "Mat_Khau": "123",
        "Vai_Tro": "NVBH",
        "Kenh": "GT",
        "Khu_Vuc": "Quận 4 & Phú Nhuận",
        "So_Dien_Thoai": "0989 345 678",
        "Email": "tri.lm@cjfoods.vn",
        "Nguoi_Quan_Ly": "gsbh.bao",
        "Tuyen_Ban_Hang": "Tuyến Thứ 3-5-7 (Quận 4 & Phú Nhuận)"
      },
      {
        "Tai_Khoan": "gsbh.tung",
        "Ma_NV": "CJ1330715",
        "Ho_Va_Ten": "Nguyễn Thanh Tùng",
        "Mat_Khau": "123",
        "Vai_Tro": "GSBH",
        "Kenh": "GT",
        "Khu_Vuc": "KV TP.HCM 2 (Tân Bình, Tân Phú, Q.7, Nhà Bè)",
        "So_Dien_Thoai": "0908 777 666",
        "Email": "tung.nt@cjfoods.vn",
        "Nguoi_Quan_Ly": "",
        "Tuyen_Ban_Hang": ""
      },
      {
        "Tai_Khoan": "sale.duc",
        "Ma_NV": "NV03",
        "Ho_Va_Ten": "Trần Văn Đức",
        "Mat_Khau": "123",
        "Vai_Tro": "NVBH",
        "Kenh": "GT",
        "Khu_Vuc": "Tân Bình & Tân Phú",
        "So_Dien_Thoai": "0912 334 455",
        "Email": "duc.tv@cjfoods.vn",
        "Nguoi_Quan_Ly": "gsbh.tung",
        "Tuyen_Ban_Hang": "Tuyến Thứ 2-4-6 (Tân Bình & Tân Phú)"
      }
    ];

    const wb = XLSX.utils.book_new();
    const wsUsers = XLSX.utils.json_to_sheet(sampleUsers);

    // Auto widths
    const keys = Object.keys(sampleUsers[0]);
    wsUsers["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 4, 16) }));

    XLSX.utils.book_append_sheet(wb, wsUsers, "DanhSach_NguoiDung");

    XLSX.writeFile(wb, "CJFoods_Mau_Import_NguoiDung.xlsx");
    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast("Đã tải file Excel mẫu khởi tạo User chuẩn DMS!", "success");
    }
  },

  /**
   * Process uploaded Excel file for Bulk User creation
   */
  async processUserExcelUpload(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("Chưa chọn file Excel User!"));

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          if (!rows || rows.length === 0) {
            return reject(new Error("File Excel không có dữ liệu người dùng!"));
          }

          const result = CJStorage.importBulkUsers(rows);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Export complete active users list to Excel (.xlsx) file
   */
  exportUsersToExcel() {
    if (typeof XLSX === "undefined") {
      alert("Thư viện SheetJS chưa sẵn sàng!");
      return;
    }

    const users = (typeof CJStorage !== "undefined" && CJStorage.getUsers) 
      ? CJStorage.getUsers() 
      : (typeof GSBH_ACCOUNTS !== "undefined" ? GSBH_ACCOUNTS : []);

    if (!users || users.length === 0) {
      alert("Không có dữ liệu người dùng để xuất!");
      return;
    }

    const customPasswords = (typeof CJAuth !== "undefined" && CJAuth.getCustomPasswords) 
      ? CJAuth.getCustomPasswords() 
      : {};

    const exportRows = users.map((u, idx) => {
      const roleStr = u.role === "admin" ? "ADMIN" : (u.role === "sales_rep" ? "NVBH" : (u.role === "asm" ? "ASM" : "GSBH"));
      const pass = customPasswords[u.username] || u.password || "123";
      const storeCount = (typeof CJStorage !== "undefined" && CJStorage.getStoresForUser) 
        ? CJStorage.getStoresForUser(u.username).length 
        : 0;

      return {
        "STT": idx + 1,
        "Tai_Khoan": u.username,
        "Ma_NV": u.empCode || "",
        "Ho_Va_Ten": u.name || "",
        "Mat_Khau": pass,
        "Vai_Tro": roleStr,
        "Kenh": u.channel || "GT",
        "Khu_Vuc": u.area || "",
        "So_Dien_Thoai": u.phone || "",
        "Email": u.email || "",
        "Nguoi_Quan_Ly": u.manager || "",
        "Tuyen_Ban_Hang": u.route || "",
        "So_KH_Phan_Cong": storeCount
      };
    });

    const wb = XLSX.utils.book_new();
    const wsUsers = XLSX.utils.json_to_sheet(exportRows);

    // Auto-fit column widths
    const keys = Object.keys(exportRows[0]);
    wsUsers["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 4, 15) }));

    XLSX.utils.book_append_sheet(wb, wsUsers, "DanhSach_User");

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `CJFoods_DanhSach_User_HeThong_${yyyy}${mm}${dd}.xlsx`;

    XLSX.writeFile(wb, filename);

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast(`✅ Đã xuất thành công ${exportRows.length} user ra file Excel: ${filename}`, "success");
    } else {
      alert(`Đã xuất thành công ${exportRows.length} user ra file Excel!`);
    }
  },

  /**
   * Xuất báo cáo tiến độ kiểm tra của từng người dùng ra file Excel
   */
  exportAuditorProgressToExcel() {
    if (typeof XLSX === "undefined") {
      alert("Thư viện SheetJS chưa sẵn sàng!");
      return;
    }

    const users = (typeof CJStorage !== "undefined" && CJStorage.getUsers) 
      ? CJStorage.getUsers() 
      : (typeof GSBH_ACCOUNTS !== "undefined" ? GSBH_ACCOUNTS : []);

    if (!users || users.length === 0) {
      alert("Không có dữ liệu người dùng để xuất!");
      return;
    }

    const exportRows = users.map((u, idx) => {
      const stats = (typeof CJStorage !== "undefined" && CJStorage.getUserAuditStats)
        ? CJStorage.getUserAuditStats(u.username)
        : { totalStores: 0, auditedStores: 0, unauditedStores: 0, completionRate: 0, goodCount: 0, abnormalCount: 0, auditsCount: 0, lastAuditTime: "" };

      const roleStr = u.role === "admin" ? "ADMIN" : (u.role === "sales_rep" ? "NVBH" : (u.role === "asm" ? "ASM" : "GSBH"));

      return {
        "STT": idx + 1,
        "Tai_Khoan": u.username,
        "Ma_NV": u.empCode || "",
        "Ho_Va_Ten": u.name || "",
        "Vai_Tro": roleStr,
        "Kenh": u.channel || "GT",
        "Khu_Vuc": u.area || "",
        "Tuyen_Ban_Hang": u.route || "",
        "Nguoi_Quan_Ly": u.manager || "",
        "Tong_So_KH": stats.totalStores,
        "Da_Kiem_Tra": stats.auditedStores,
        "Chua_Kiem_Tra": stats.unauditedStores,
        "Ty_Le_Hoan_Thanh": `${stats.completionRate}%`,
        "Tu_Dat_Chuan": stats.goodCount,
        "Tu_Bat_Thuong": stats.abnormalCount,
        "So_Luot_Audit": stats.auditsCount,
        "Lan_Kiem_Tra_Cuoi": stats.lastAuditTime || "Chưa có"
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);

    const keys = Object.keys(exportRows[0]);
    ws["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 4, 15) }));

    XLSX.utils.book_append_sheet(wb, ws, "TienDo_KiemTra_TungNguoi");

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `CJFoods_BaoCao_TienDo_KiemTra_${yyyy}${mm}${dd}.xlsx`;

    XLSX.writeFile(wb, filename);

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast(`✅ Đã xuất báo cáo tiến độ ${exportRows.length} nhân sự ra file: ${filename}`, "success");
    } else {
      alert(`Đã xuất báo cáo tiến độ ${exportRows.length} nhân sự ra file Excel!`);
    }
  }
};
