/**
 * CJ MarketAudit - Storage & Local Database Manager
 * Strict GSBH Isolation: Only stores of the logged-in GSBH are returned
 */

const CJStorage = {
  KEYS: {
    STORES: "cj_market_audit_stores_gsbh_v5",
    FREEZERS: "cj_market_audit_freezers_gsbh_v5",
    AUDITS: "cj_market_audit_audits_gsbh_v5",
    ORDERS: "cj_market_audit_orders_v1",
    USERS: "cj_market_audit_users_v6",
    TICKETS: "cj_market_audit_tickets_v5"
  },

  init() {
    const DATA_VERSION = "2026.09.09_ADMIN_FIX_V5";
    const currentVer = localStorage.getItem("cj_market_audit_data_ver");
    
    // Auto-migrate to official master data if version changed or if stores/users are empty
    const existingStores = localStorage.getItem(this.KEYS.STORES);
    const existingUsers = localStorage.getItem(this.KEYS.USERS);
    let needInit = false;

    if (currentVer !== DATA_VERSION) {
      needInit = true;
    } else if (!existingStores || existingStores === "[]" || !existingUsers) {
      needInit = true;
    }

    if (needInit) {
      localStorage.setItem(this.KEYS.USERS, JSON.stringify(GSBH_ACCOUNTS));
      localStorage.setItem(this.KEYS.STORES, JSON.stringify(INITIAL_STORES));
      localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify(INITIAL_FREEZERS));
      if (!localStorage.getItem(this.KEYS.AUDITS)) {
        localStorage.setItem(this.KEYS.AUDITS, JSON.stringify(INITIAL_AUDITS));
      }
      if (!localStorage.getItem(this.KEYS.ORDERS)) {
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
      }
      if (!localStorage.getItem(this.KEYS.TICKETS)) {
        localStorage.setItem(this.KEYS.TICKETS, JSON.stringify([]));
      }
      localStorage.setItem("cj_market_audit_data_ver", DATA_VERSION);
    } else {
      if (!localStorage.getItem(this.KEYS.USERS)) {
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(GSBH_ACCOUNTS));
      }
      if (!localStorage.getItem(this.KEYS.STORES)) {
        localStorage.setItem(this.KEYS.STORES, JSON.stringify(INITIAL_STORES));
      }
      if (!localStorage.getItem(this.KEYS.FREEZERS)) {
        localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify(INITIAL_FREEZERS));
      }
      if (!localStorage.getItem(this.KEYS.AUDITS)) {
        localStorage.setItem(this.KEYS.AUDITS, JSON.stringify(INITIAL_AUDITS));
      }
      if (!localStorage.getItem(this.KEYS.ORDERS)) {
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
      }
      if (!localStorage.getItem(this.KEYS.TICKETS)) {
        localStorage.setItem(this.KEYS.TICKETS, JSON.stringify([]));
      }
    }

    // Auto-reconcile stores & freezers: đảm bảo serialNumber và barcode luôn lấy đúng Cột L (So_Serial)
    try {
      const storesRaw = localStorage.getItem(this.KEYS.STORES);
      const freezersRaw = localStorage.getItem(this.KEYS.FREEZERS);
      if (storesRaw) {
        let stores = JSON.parse(storesRaw);
        let freezers = freezersRaw ? JSON.parse(freezersRaw) : [];
        let changed = false;
        if (Array.isArray(stores)) {
          // Xóa bỏ triệt để toàn bộ các điểm bán mẫu demo (STR-GT-) và tủ mẫu (FZ-CJ-)
          const filteredStores = stores.filter(s => !s.id.startsWith("STR-GT-"));
          if (filteredStores.length !== stores.length) {
            stores = filteredStores;
            changed = true;
          }
          if (Array.isArray(freezers)) {
            const filteredFreezers = freezers.filter(f => !f.id.startsWith("FZ-CJ-"));
            if (filteredFreezers.length !== freezers.length) {
              freezers = filteredFreezers;
              localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify(freezers));
            }
          }

          stores.forEach((s, idx) => {
            if (!s.serialNumber || s.serialNumber.startsWith("SNK-202400") || s.serialNumber === "undefined") {
              const fz = freezers.find(f => f.assignedStoreId === s.id || f.id === s.freezerId);
              if (fz && fz.serialNumber && !fz.serialNumber.startsWith("SNK-202400")) {
                s.serialNumber = fz.serialNumber;
                s.barcode = fz.serialNumber;
                changed = true;
              } else if (s.freezerId && s.freezerId.startsWith("TDO")) {
                s.serialNumber = s.freezerId;
                s.barcode = s.freezerId;
                changed = true;
              }
            }
            if (!s.modelTu && !s.freezerModel) {
              const fz = freezers.find(f => f.assignedStoreId === s.id || f.id === s.freezerId);
              s.modelTu = (fz && fz.model) || "Tủ đông SANAKY 330L";
              s.freezerModel = s.modelTu;
              changed = true;
            }
            if (s.phone === "0903000000" || s.phone === "0903 000 000") {
              s.phone = "";
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem(this.KEYS.STORES, JSON.stringify(stores));
          }
        }
      }
    } catch (e) {}
  },

  getUsers() {
    this.init();
    try {
      const users = JSON.parse(localStorage.getItem(this.KEYS.USERS));
      if (Array.isArray(users) && users.length > 0) {
        if (!users.some(u => u.username === "admin")) {
          users.unshift(GSBH_ACCOUNTS[0]);
          this.saveUsers(users);
        }
        return users;
      }
    } catch (e) {
      console.error(e);
    }
    return [...GSBH_ACCOUNTS];
  },

  saveUsers(users) {
    if (!Array.isArray(users)) return;
    if (!users.some(u => u.username === "admin")) {
      users.unshift(GSBH_ACCOUNTS[0]);
    }
    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
    if (typeof GSBH_ACCOUNTS !== "undefined") {
      GSBH_ACCOUNTS.length = 0;
      GSBH_ACCOUNTS.push(...users);
    }
  },

  resetUsersToAdminOnly() {
    const adminOnly = [
      {
        username: "admin",
        empCode: "CJ9999999",
        password: "123",
        name: "Admin",
        role: "admin",
        roleTitle: "Giám Đốc RTM & DMS Toàn Quốc",
        area: "Toàn Quốc (GT, MT, B2B)",
        phone: "0901 888 999",
        email: "tuan.ta@cjfoods.vn",
        avatar: "👑",
        teamSalesReps: []
      }
    ];
    this.saveUsers(adminOnly);
    return adminOnly;
  },

  deleteUser(username) {
    if (!username || username.toLowerCase() === "admin") {
      return { success: false, message: "Không thể xóa tài khoản Quản trị tối cao (admin)!" };
    }
    const current = this.getUsers();
    const filtered = current.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    this.saveUsers(filtered);
    return { success: true, message: `Đã xóa tài khoản "${username}" thành công!` };
  },

  importBulkUsers(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, message: "Không có dữ liệu người dùng để nạp!" };
    }

    const currentUsers = this.getUsers();
    const userMap = new Map();
    currentUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));

    let addedCount = 0;
    let updatedCount = 0;
    const newRepsForGsbh = {};

    rows.forEach((row, idx) => {
      const username = String(row["Tai_Khoan"] || row["User"] || row["Username"] || row["Ten_Dang_Nhap"] || row["Tài Khoản"] || "").trim();
      if (!username) return;

      const empCode = String(row["Ma_NV"] || row["Mã NV"] || row["Ma_Nhan_Vien"] || row["Code"] || ("CJ" + (1330700 + idx))).trim();
      const name = String(row["Ho_Va_Ten"] || row["Họ Và Tên"] || row["Ten_Day_Du"] || row["Ten_user"] || row["Ten_User"] || username).trim();
      const password = String(row["Mat_Khau"] || row["Mật Khẩu"] || row["Password"] || "123").trim();
      const rawRole = String(row["Vai_Tro"] || row["Vai Trò"] || row["Role"] || "GSBH").trim().toUpperCase();
      const channel = String(row["Kenh"] || row["Kênh"] || row["Channel"] || "GT").trim().toUpperCase();
      const area = String(row["Khu_Vuc"] || row["Khu Vực"] || row["Area"] || "Khu vực phân phối").trim();
      const phone = String(row["So_Dien_Thoai"] || row["Số Điện Thoại"] || row["SDT"] || row["Phone"] || "").trim();
      const email = String(row["Email"] || "").trim();
      const manager = String(row["Nguoi_Quan_Ly"] || row["Người Quản Lý"] || row["Quan_Ly_Truc_Tiep"] || row["GSBH_Quan_Ly"] || "").trim().toLowerCase();
      const route = String(row["Tuyen_Ban_Hang"] || row["Tuyến Bán Hàng"] || row["Tuyen"] || "").trim();

      let role = "gsbh_gt";
      let roleTitle = "GSBH Kênh " + channel;
      let avatar = "👮‍♂️";

      if (rawRole.includes("ADMIN") || rawRole.includes("QUAN TRI")) {
        role = "admin";
        roleTitle = "Quản Trị Viên (Admin RTM)";
        avatar = "👑";
      } else if (rawRole.includes("NVBH") || rawRole.includes("SALE") || rawRole.includes("SR") || rawRole.includes("NHAN VIEN")) {
        role = "sales_rep";
        roleTitle = `NVBH Kênh ${channel}`;
        avatar = "👤";
      } else if (rawRole.includes("ASM") || rawRole.includes("VUNG")) {
        role = "asm";
        roleTitle = `Quản Lý Vùng (${channel})`;
        avatar = "👔";
      } else {
        role = "gsbh_gt";
        roleTitle = `GSBH Kênh ${channel}`;
        avatar = "👮‍♂️";
      }

      const userObj = {
        username: username,
        empCode: empCode,
        password: password,
        name: name,
        role: role,
        roleTitle: roleTitle,
        channel: channel,
        area: area,
        phone: phone,
        email: email,
        avatar: avatar,
        manager: manager,
        route: route,
        teamSalesReps: []
      };

      if (userMap.has(username.toLowerCase())) {
        const existing = userMap.get(username.toLowerCase());
        userMap.set(username.toLowerCase(), { ...existing, ...userObj, teamSalesReps: existing.teamSalesReps || [] });
        updatedCount++;
      } else {
        userMap.set(username.toLowerCase(), userObj);
        addedCount++;
      }

      if (role === "sales_rep" && manager) {
        if (!newRepsForGsbh[manager]) newRepsForGsbh[manager] = [];
        newRepsForGsbh[manager].push({
          code: empCode || ("NV" + String(idx + 1).padStart(2, "0")),
          username: username,
          name: name,
          phone: phone,
          route: route || area
        });
      }
    });

    Object.keys(newRepsForGsbh).forEach(mgrUser => {
      if (userMap.has(mgrUser)) {
        const mgr = userMap.get(mgrUser);
        const existingReps = mgr.teamSalesReps || [];
        const existingUsernames = new Set(existingReps.map(r => r.username.toLowerCase()));
        newRepsForGsbh[mgrUser].forEach(newRep => {
          if (!existingUsernames.has(newRep.username.toLowerCase())) {
            existingReps.push(newRep);
          }
        });
        mgr.teamSalesReps = existingReps;
      }
    });

    const finalUsers = Array.from(userMap.values());
    this.saveUsers(finalUsers);

    return {
      success: true,
      message: `Đã nạp thành công ${addedCount} tài khoản mới, cập nhật ${updatedCount} tài khoản!`,
      addedCount,
      updatedCount,
      totalCount: finalUsers.length
    };
  },

  getAllStores() {
    this.init();
    try {
      let stores = JSON.parse(localStorage.getItem(this.KEYS.STORES));
      if (!Array.isArray(stores)) return [];
      return stores.filter(s => !s.id.startsWith("STR-GT-"));
    } catch (e) {
      return [];
    }
  },

  /**
   * CRITICAL FILTER:
   * Returns ONLY stores assigned to the logged-in GSBH or Sales Rep!
   */
  getStoresForCurrentGSBH(salesRepUsername = "ALL") {
    const all = this.getAllStores();
    const currentUser = CJAuth.getCurrentUser();
    if (!currentUser) return [];

    let gsbhStores = all;
    if (CJAuth.isAdmin()) {
      // If Admin has selected a specific user to view/control
      const controlled = (typeof CJApp !== "undefined" && CJApp.adminControlledUser) ? CJApp.adminControlledUser : "ALL";
      if (controlled !== "ALL") {
        gsbhStores = this.getStoresForUser(controlled);
      }
    } else {
      // Strictly isolate by logged-in user account (GSBH or Sales Rep)
      gsbhStores = this.getStoresForUser(currentUser.username);
    }

    if (!salesRepUsername || salesRepUsername === "ALL") {
      return gsbhStores;
    }
    const repLower = salesRepUsername.toLowerCase();
    return gsbhStores.filter(s => 
      (s.assignedUser && s.assignedUser.toLowerCase() === repLower) ||
      (s.salesRepCode && s.salesRepCode.toLowerCase() === repLower) ||
      (s.salesRep && s.salesRep.toLowerCase() === repLower)
    );
  },

  /**
   * Universal Store lookup supporting user object or username string (Admin / GSBH / SR)
   */
  getStoresForUser(userOrUsername) {
    const all = this.getAllStores();
    if (!userOrUsername || userOrUsername === "ALL") return all;

    const username = typeof userOrUsername === "object" ? userOrUsername.username : String(userOrUsername);
    if (!username || username === "ALL" || username.toLowerCase() === "admin") return all;

    const lower = username.toLowerCase();
    return all.filter(s => 
      (s.gsbhUsername && s.gsbhUsername.toLowerCase() === lower) ||
      (s.assignedUser && s.assignedUser.toLowerCase() === lower) ||
      (s.salesRepCode && s.salesRepCode.toLowerCase() === lower) ||
      (s.salesRep && s.salesRep.toLowerCase() === lower)
    );
  },

  getStoreById(id) {
    const stores = this.getAllStores();
    return stores.find(s => s.id === id) || null;
  },

  addStore(store) {
    const stores = this.getAllStores();
    stores.unshift(store);
    localStorage.setItem(this.KEYS.STORES, JSON.stringify(stores));
    return store;
  },

  updateStore(updatedStore) {
    const stores = this.getAllStores();
    const idx = stores.findIndex(s => s.id === updatedStore.id);
    if (idx !== -1) {
      stores[idx] = updatedStore;
      localStorage.setItem(this.KEYS.STORES, JSON.stringify(stores));
    }
    return updatedStore;
  },

  saveStore(updatedStore) {
    return this.updateStore(updatedStore);
  },

  getFreezers() {
    this.init();
    try {
      let freezers = JSON.parse(localStorage.getItem(this.KEYS.FREEZERS));
      if (!Array.isArray(freezers)) return [];
      return freezers.filter(f => !f.id.startsWith("FZ-CJ-"));
    } catch (e) {
      return [];
    }
  },

  getFreezerById(id) {
    const freezers = this.getFreezers();
    return freezers.find(f => f.id === id) || null;
  },

  getFreezersForStore(storeId) {
    if (!storeId) return [];
    const freezers = this.getFreezers();
    return freezers.filter(f => f.assignedStoreId === storeId);
  },

  getFreezersForCurrentGSBH(selectedSales = "ALL") {
    const stores = this.getStoresForCurrentGSBH(selectedSales);
    const storeIdSet = new Set(stores.map(s => s.id));
    const allFreezers = this.getFreezers();
    return allFreezers.filter(f => storeIdSet.has(f.assignedStoreId));
  },

  getAudits() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.AUDITS)) || INITIAL_AUDITS;
    } catch (e) {
      return INITIAL_AUDITS;
    }
  },

  getAuditsForCurrentGSBH() {
    const audits = this.getAudits();
    const currentUser = CJAuth.getCurrentUser();
    if (!currentUser) return [];
    if (CJAuth.isAdmin()) {
      const controlled = (typeof CJApp !== "undefined" && CJApp.adminControlledUser) ? CJApp.adminControlledUser : "ALL";
      if (controlled !== "ALL") {
        return this.getAuditsForUser(controlled);
      }
      return audits;
    }
    return this.getAuditsForUser(currentUser.username);
  },

  /**
   * Universal Audit lookup supporting user object or username string (Admin / GSBH / SR)
   */
  getAuditsForUser(userOrUsername) {
    const all = this.getAudits();
    if (!userOrUsername || userOrUsername === "ALL") return all;

    const username = typeof userOrUsername === "object" ? userOrUsername.username : String(userOrUsername);
    if (!username || username === "ALL" || username === "admin") return all;

    const lower = username.toLowerCase();
    return all.filter(a => 
      (a.gsbhUsername && a.gsbhUsername.toLowerCase() === lower) ||
      (a.auditorUser && a.auditorUser.toLowerCase() === lower) ||
      (a.assignedUser && a.assignedUser.toLowerCase() === lower)
    );
  },

  getAuditById(id) {
    const audits = this.getAudits();
    return audits.find(a => a.id === id) || null;
  },

  saveAudit(auditData) {
    const audits = this.getAudits();
    audits.unshift(auditData);
    try {
      localStorage.setItem(this.KEYS.AUDITS, JSON.stringify(audits));
    } catch (quotaErr) {
      console.warn("Storage quota exceeded, trimming old audits:", quotaErr);
      try {
        const trimmed = audits.slice(0, 30);
        localStorage.setItem(this.KEYS.AUDITS, JSON.stringify(trimmed));
      } catch (e2) {
        console.warn("Still exceeded, saving without heavy base64:", e2);
        try {
          const lightweight = audits.slice(0, 20).map(a => ({ ...a, photos: {} }));
          localStorage.setItem(this.KEYS.AUDITS, JSON.stringify(lightweight));
        } catch (e3) {
          console.error("Local audit save failed:", e3);
        }
      }
    }

    if (auditData.storeId) {
      const store = this.getStoreById(auditData.storeId);
      if (store) {
        store.status = (auditData.tempStatus === 'pass' && auditData.score >= 80) ? 'good' : ((auditData.tempStatus === 'danger' || !auditData.isPowered) ? 'danger' : 'warning');
        store.isAudited = true;
        const now = new Date();
        store.lastAuditDate = now.toLocaleDateString("vi-VN");
        store.lastAuditTime = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        store.lastAuditFull = `${store.lastAuditTime} ${store.lastAuditDate}`;
        store.lastAuditor = auditData.auditorName || (typeof CJAuth !== "undefined" && CJAuth.getCurrentUser()?.name) || "";
        store.posmCondition = auditData.condition || auditData.workingCondition || "Hoạt động tốt";
        store.lastTemp = auditData.temperature;
        store.lastScore = auditData.score;
        this.updateStore(store);
      }
    }

    if (auditData.freezerId) {
      const freezers = this.getFreezers();
      const freezer = freezers.find(f => f.id === auditData.freezerId);
      if (freezer) {
        freezer.lastTemperature = auditData.temperature;
        freezer.status = (auditData.tempStatus === 'pass' && auditData.score >= 80) ? 'good' : ((auditData.tempStatus === 'danger' || !auditData.isPowered) ? 'danger' : 'warning');
        localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify(freezers));
      }
    }

    return auditData;
  },

  saveTicket(ticket) {
    if (!ticket) return null;
    try {
      const tickets = JSON.parse(localStorage.getItem(this.KEYS.TICKETS) || "[]");
      const idx = tickets.findIndex(t => t.ticketId === ticket.ticketId);
      if (idx >= 0) {
        tickets[idx] = { ...tickets[idx], ...ticket };
      } else {
        tickets.unshift(ticket);
      }
      localStorage.setItem(this.KEYS.TICKETS, JSON.stringify(tickets.slice(0, 100)));
    } catch (e) {
      console.warn("Could not save ticket to local tickets list:", e);
    }
    return ticket;
  },

  getTickets() {
    const audits = this.getAuditsForCurrentGSBH();
    const auditTickets = audits
      .filter(a => a.ticketCreated && a.ticketDetails)
      .map(a => ({
        ...a.ticketDetails,
        auditId: a.id,
        storeId: a.storeId,
        storeName: a.storeName,
        channel: a.channel,
        temperature: a.temperature,
        auditorName: a.auditorName,
        assetTag: a.assetTag
      }));

    let standaloneTickets = [];
    try {
      standaloneTickets = JSON.parse(localStorage.getItem(this.KEYS.TICKETS) || "[]");
    } catch (e) {}

    const seen = new Set();
    const combined = [];
    [...auditTickets, ...standaloneTickets].forEach(t => {
      if (t && t.ticketId && !seen.has(t.ticketId)) {
        seen.add(t.ticketId);
        combined.push(t);
      }
    });
    return combined;
  },

  updateTicketStatus(ticketId, newStatus) {
    const audits = this.getAudits();
    let updated = false;
    audits.forEach(a => {
      if (a.ticketDetails && a.ticketDetails.ticketId === ticketId) {
        a.ticketDetails.status = newStatus;
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem(this.KEYS.AUDITS, JSON.stringify(audits));
    }

    try {
      const tickets = JSON.parse(localStorage.getItem(this.KEYS.TICKETS) || "[]");
      const t = tickets.find(x => x.ticketId === ticketId);
      if (t) {
        t.status = newStatus;
        localStorage.setItem(this.KEYS.TICKETS, JSON.stringify(tickets));
        updated = true;
      }
    } catch (e) {}

    return updated;
  },

  /**
   * Bulk import stores & freezers from Excel rows (with Lat/Lon & Target User Assignment support)
   */
  importBulkStoresAndFreezers(rows, targetUserOverride = "AUTO", replaceAll = false) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error("Dữ liệu Excel rỗng hoặc không đúng định dạng!");
    }

    // Nếu chọn nạp mới hoàn toàn (replaceAll) hoặc nếu kho rỗng: khởi tạo mảng rỗng 100%
    let stores = replaceAll ? [] : this.getAllStores().filter(s => !s.id.startsWith("STR-GT-"));
    let freezers = replaceAll ? [] : this.getFreezers().filter(f => !f.id.startsWith("FZ-CJ-"));

    let importedCount = 0;
    const gsbhDistribution = {};

    // Helper: find user info if targetUserOverride is provided
    let overrideGsbh = null;
    let overrideRep = null;

    const allUsers = this.getUsers();

    if (targetUserOverride && targetUserOverride !== "AUTO") {
      // Check if target is a GSBH / Admin
      const gsbh = allUsers.find(g => g.username.toLowerCase() === targetUserOverride.toLowerCase());
      if (gsbh) {
        overrideGsbh = gsbh;
        overrideRep = gsbh.teamSalesReps && gsbh.teamSalesReps[0] ? gsbh.teamSalesReps[0] : null;
      } else {
        // Check if target is a Sales Rep
        for (const g of allUsers) {
          if (g.teamSalesReps) {
            const foundRep = g.teamSalesReps.find(r => r.username.toLowerCase() === targetUserOverride.toLowerCase());
            if (foundRep) {
              overrideGsbh = g;
              overrideRep = foundRep;
              break;
            }
          }
        }
      }
    }

    // Helper: normalize key name with deep fuzzy and column index matching (Khớp 100% Cột L: So_Serial)
    const getVal = (row, candidates, colIndex = -1) => {
      // 1. Direct match
      for (const c of candidates) {
        if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "") {
          return String(row[c]).trim();
        }
      }
      // 2. Fuzzy match across all row keys (ignoring case, spaces, underscores, hyphens)
      const rowKeys = Object.keys(row);
      for (const c of candidates) {
        const cleanCandidate = c.toLowerCase().replace(/[\s_\-.]/g, "");
        for (const k of rowKeys) {
          const cleanKey = k.toLowerCase().replace(/[\s_\-.]/g, "");
          if (cleanKey === cleanCandidate) {
            const v = row[k];
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              return String(v).trim();
            }
          }
        }
      }
      // 3. Optional column index match (e.g. Cột L trong Excel là cột 12, index 11)
      if (colIndex >= 0) {
        const rowVals = Object.values(row);
        if (rowVals.length > colIndex && rowVals[colIndex] !== undefined && rowVals[colIndex] !== null && String(rowVals[colIndex]).trim() !== "") {
          return String(rowVals[colIndex]).trim();
        }
      }
      return "";
    };

    rows.forEach((row, idx) => {
      // Extract fields with multiple possible column headers
      const storeId = getVal(row, ["Ma_KH", "Mã KH", "Mã Khách Hàng", "MaKH", "Mã Điểm Bán", "ID"], 2) || `STR-IMP-${100 + idx}`;
      const storeName = getVal(row, ["Ten_KH", "Tên KH", "Tên Khách Hàng", "Tên Cửa Hàng", "TenCuaHang", "Tên Điểm Bán"], 3) || `Điểm Bán ${storeId}`;
      const channel = (getVal(row, ["Kenh", "Kênh", "Channel"]) || "GT").toUpperCase();
      let route = getVal(row, ["Tuyen_Ban_Hang", "Tuyến Bán Hàng", "Tuyen", "Tuyến", "Route"]) || "Tuyến Mặc Định";
      const address = getVal(row, ["Dia_Chi", "Địa Chỉ", "DiaChi", "Address"], 4) || "TP. Hồ Chí Minh";
      const owner = getVal(row, ["Chu_Cua_Hang", "Chủ Cửa Hàng", "ChuTiem", "Chủ Tiệm", "Owner"]) || "Chủ cửa hàng";
      const phone = getVal(row, ["So_Dien_Thoai", "Số Điện Thoại", "SDT", "Phone", "Điện Thoại", "SoDienThoai", "SĐT"], 5) || "";

      // GSBH & Sales Rep Mapping (Apply targetUserOverride if specified by Admin)
      let gsbhUsername = "";
      let gsbhName = "";
      let salesRepCode = "";
      let salesRep = "";
      let salesRepPhone = "";
      let assignedUser = "";

      if (overrideGsbh) {
        gsbhUsername = overrideGsbh.username;
        gsbhName = overrideGsbh.name;
        if (overrideRep) {
          salesRepCode = overrideRep.code;
          salesRep = overrideRep.name;
          salesRepPhone = overrideRep.phone;
          assignedUser = overrideRep.username;
          if (!route || route === "Tuyến Mặc Định") route = overrideRep.route;
        } else {
          salesRepCode = "NV01";
          salesRep = overrideGsbh.name;
          salesRepPhone = overrideGsbh.phone || "0901 888 999";
          assignedUser = overrideGsbh.username;
        }
      } else {
        // GSBH auto mapping from file (supports "User", "Ten_user" from user's 14-column template)
        const rawUser = (getVal(row, ["User", "user", "Tai_Khoan_GSBH", "Tài Khoản GSBH", "GSBH_Username", "GSBH", "GSBH Phụ Trách"], 0) || "admin").toLowerCase();
        
        let gsbhObj = allUsers.find(g => g.username.toLowerCase() === rawUser);
        let matchedRep = null;

        // If rawUser is a Sales Rep instead of GSBH
        if (!gsbhObj) {
          for (const g of allUsers) {
            if (g.teamSalesReps) {
              const r = g.teamSalesReps.find(rep => rep.username.toLowerCase() === rawUser || rep.code.toLowerCase() === rawUser);
              if (r) {
                gsbhObj = g;
                matchedRep = r;
                break;
              }
            }
          }
        }

        if (!gsbhObj) {
          gsbhObj = allUsers[0] || { username: "admin", name: "Admin" };
        }
        gsbhUsername = gsbhObj.username;
        gsbhName = getVal(row, ["Ten_user", "Ten_User", "Ten user", "Ten_GSBH", "Tên GSBH", "GSBH Name"], 1) || gsbhObj.name;

        // NVBH auto mapping from file (supports Ma_NVBH: NV01..NV06, Ten_NVBH)
        salesRepCode = getVal(row, ["Ma_NVBH", "Mã NVBH", "Sales Code", "Mã Nhân Viên"], 6) || (matchedRep ? matchedRep.code : "NV01");
        salesRep = getVal(row, ["Ten_NVBH", "Tên NVBH", "Nhan_Vien_Phu_Trach", "Nhân Viên Phụ Trách", "Sales Rep"], 7) || (matchedRep ? matchedRep.name : gsbhObj.name);

        // Find rep inside GSBH team by code or name
        if (gsbhObj.teamSalesReps) {
          const found = gsbhObj.teamSalesReps.find(r => r.code === salesRepCode || r.name.toLowerCase() === salesRep.toLowerCase());
          if (found) matchedRep = found;
        }

        salesRepPhone = matchedRep ? matchedRep.phone : (getVal(row, ["SDT_NVBH", "SĐT NVBH", "SĐT Sales", "Sales Phone"]) || gsbhObj.phone || "0901 888 999");
        assignedUser = matchedRep ? matchedRep.username : (getVal(row, ["Tai_Khoan_NVBH", "Tài Khoản NVBH", "assignedUser", "User Sales"]) || gsbhObj.username).toLowerCase();
        
        if (!route || route === "Tuyến Mặc Định") {
          route = matchedRep ? matchedRep.route : (gsbhObj.area ? `Tuyến ${gsbhObj.area.split('(')[0].trim()}` : "Tuyến Đi Tuyến GT");
        }
      }

      // Freezer Asset mapping - CHÍNH XÁC THEO CỘT EXCEL (Cột I: Ma_Tu_Dong, Cột J: Model_Tu, Cột K: Dung_Tich, Cột L: So_Serial)
      const modelCode = getVal(row, ["Ma_Tu_Dong", "Mã Tủ Đông", "Freezer ID", "Asset Tag", "Mã Tủ"], 8) || "TDOSNK330";
      const model = getVal(row, ["Model_Tu", "Model Tủ", "Model", "Loại Tủ", "Tên Tủ", "Ten_Tu", "TenTu"], 9) || "Tủ đông SANAKY 330L";
      const capacity = getVal(row, ["Dung_Tich", "Dung Tích", "Capacity"], 10) || "350L";

      // ĐÂY LÀ ĐIỂM QUAN TRỌNG NHẤT: LẤY CHÍNH XÁC DATA TRONG CỘT L (So_Serial)
      const serial = getVal(row, [
        "So_Serial", "So_serial", "so_serial", "Số_Serial", "Số Serial", 
        "SoSerial", "Serial", "Serial_Number", "SerialNumber", "Mã Serial", 
        "Barcode", "Mã Barcode"
      ], 11) || `TDO${String(1000 + idx).padStart(5, '0')}`;

      const brand = getVal(row, ["Thuong_Hieu", "Thương Hiệu", "Brand", "Nhãn Hàng"]) || (model.toLowerCase().includes("alaska") ? "Cầu Tre" : "Bibigo");

      // Coordinates (Lat / Lon) - Cột M: Vi_Do_Lat, Cột N: Kinh_Do_Lon
      let rawLat = getVal(row, ["Vi_Do_Lat", "Vĩ Độ", "Vĩ độ (Lat)", "Latitude", "Lat"], 12);
      let rawLon = getVal(row, ["Kinh_Do_Lon", "Kinh Độ", "Kinh độ (Lon)", "Longitude", "Lon", "Lng"], 13);

      let lat = parseFloat(rawLat);
      let lng = parseFloat(rawLon);

      // If coordinates missing or invalid, generate realistic default coordinates near center
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        lat = 10.7769 + (Math.random() - 0.5) * 0.08;
        lng = 106.7009 + (Math.random() - 0.5) * 0.08;
      }

      // Upsert freezer: Barcode và Serial Number lấy 100% từ Cột L (So_Serial), Tên tủ lấy từ Cột J (Model_Tu)
      const freezerId = serial || `FZ-CJ-${100 + idx}`;
      const existingFzIdx = freezers.findIndex(f => f.id === freezerId || f.serialNumber === serial || f.barcode === serial);
      const freezerData = {
        id: freezerId,
        assetTag: serial,
        barcode: serial,
        serialNumber: serial,
        modelCode: modelCode,
        brandAssigned: brand,
        model: model,
        modelTu: model,
        freezerModel: model,
        capacity: capacity,
        assignedStoreId: storeId,
        assignedStoreName: storeName,
        status: "good",
        lastTemperature: -18
      };
      if (existingFzIdx >= 0) {
        freezers[existingFzIdx] = { ...freezers[existingFzIdx], ...freezerData };
      } else {
        freezers.push(freezerData);
      }

      // Upsert store: gán trực tiếp serialNumber và barcode từ Cột L (So_Serial), tên tủ từ Cột J (Model_Tu)
      const existingStoreIdx = stores.findIndex(s => s.id === storeId);
      const storeData = {
        id: storeId,
        name: storeName,
        channel: channel,
        route: route,
        address: address,
        phone: phone,
        owner: owner,
        gsbhUsername: gsbhUsername,
        gsbhName: gsbhName,
        salesRepCode: salesRepCode,
        salesRep: salesRep,
        salesRepPhone: salesRepPhone,
        assignedUser: assignedUser,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        freezerId: freezerId,
        serialNumber: serial,
        barcode: serial,
        modelCode: modelCode,
        model: model,
        modelTu: model,
        freezerModel: model,
        status: "good",
        lastAuditDate: "Chưa kiểm tra",
        lastTemp: -18,
        lastScore: 100
      };

      if (existingStoreIdx >= 0) {
        stores[existingStoreIdx] = { ...stores[existingStoreIdx], ...storeData };
      } else {
        stores.push(storeData);
      }

      gsbhDistribution[gsbhUsername] = (gsbhDistribution[gsbhUsername] || 0) + 1;
      importedCount++;
    });

    // Save to localStorage
    localStorage.setItem(this.KEYS.STORES, JSON.stringify(stores));
    localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify(freezers));

    return {
      success: true,
      count: importedCount,
      gsbhDistribution: gsbhDistribution
    };
  },

  getOrders() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.ORDERS)) || [];
    } catch (e) {
      return [];
    }
  },

  saveOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    return order;
  },

  getOrdersForStore(storeId) {
    return this.getOrders().filter(o => o.storeId === storeId);
  },

  clearAllStores() {
    localStorage.setItem(this.KEYS.STORES, JSON.stringify([]));
    localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.AUDITS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.TICKETS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
    return true;
  },

  clearAuditsAndTickets() {
    localStorage.setItem(this.KEYS.AUDITS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.TICKETS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));

    // Reset status and lastAuditDate on stores without touching customer list
    try {
      const stores = this.getAllStores();
      stores.forEach(s => {
        s.status = "good";
        s.isAudited = false;
        s.lastAuditDate = "Chưa kiểm tra";
        delete s.lastAuditTime;
        delete s.lastAuditFull;
        delete s.lastAuditor;
        s.posmCondition = "Sử Dụng Được";
        delete s.ticketCreated;
        delete s.ticketDetails;
      });
      localStorage.setItem(this.KEYS.STORES, JSON.stringify(stores));
    } catch (e) {
      console.warn("Error resetting store audit status:", e);
    }
    return true;
  },

  resetAllData() {
    localStorage.setItem(this.KEYS.STORES, JSON.stringify([]));
    localStorage.setItem(this.KEYS.FREEZERS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.AUDITS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
    localStorage.setItem(this.KEYS.TICKETS, JSON.stringify([]));
  }
};
