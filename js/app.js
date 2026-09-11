/**
 * CJ MarketAudit - Application Controller & View Switcher
 * Authentication & GSBH Customer Boundary Guard
 */

const CJApp = {
  currentTab: "dashboard",
  isMobileDevice: false,
  deviceViewMode: "mobile", // "mobile" (phone simulator) or "desktop" (web portal)
  adminControlledUser: "ALL", // "ALL" or specific GSBH username or Sales Rep username

  init() {
    CJAuth.init();
    CJStorage.init();

    const currentUser = CJAuth.getCurrentUser();
    if (!currentUser) {
      this.showLoginModal();
    } else {
      this.hideLoginModal();
      this.onUserLoggedIn(currentUser);
    }

    this.checkDevice();

    // Restore saved device view mode preference or default to mobile
    const savedMode = localStorage.getItem("cj_device_view_mode");
    if (savedMode && (savedMode === "mobile" || savedMode === "desktop")) {
      this.deviceViewMode = savedMode;
    }
    this.applyDeviceViewMode();

    window.addEventListener("resize", () => {
      this.applyDeviceViewMode();
    });

    this.bindNavigation();
    this.bindAuthEvents();
    this.bindImportModalEvents();

    // Update login status bar clock (09:42 style)
    const loginClockEl = document.getElementById("loginClock");
    const dashClockEl = document.getElementById("dashMobileClock");
    const customerClockEl = document.getElementById("customerListClock");
    const updateAllClocks = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;
      if (loginClockEl) loginClockEl.textContent = timeStr;
      if (dashClockEl) dashClockEl.textContent = timeStr;
      if (customerClockEl) customerClockEl.textContent = timeStr;
    };
    updateAllClocks();
    setInterval(updateAllClocks, 30000);
  },

  checkDevice() {
    this.isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (this.isMobileDevice) {
      document.body.classList.add("is-mobile-screen");
    }
  },

  setDeviceViewMode(mode) {
    this.deviceViewMode = mode;
    localStorage.setItem("cj_device_view_mode", mode);
    this.applyDeviceViewMode();
    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast(
        mode === 'mobile' ? "📱 Đã chuyển sang Bản Điện Thoại (DMS Mobile App)" : "💻 Đã chuyển sang Bản Máy Tính (DMS Web Portal)",
        "info"
      );
    }
  },

  toggleDeviceMode() {
    const next = this.deviceViewMode === "mobile" ? "desktop" : "mobile";
    this.setDeviceViewMode(next);
  },

  applyDeviceViewMode() {
    const isSmallScreen = window.innerWidth < 768;
    const isUser = !CJAuth.isAdmin();
    const effectiveMode = (isSmallScreen || isUser) ? "mobile" : this.deviceViewMode;

    const shell = document.getElementById("appDeviceShell");
    const btnMobile = document.getElementById("btnModeMobile");
    const btnDesktop = document.getElementById("btnModeDesktop");
    const indicator = document.getElementById("deviceModeIndicator");
    const toggleFrameLabel = document.getElementById("btnToggleFrameLabel");

    if (effectiveMode === "mobile") {
      document.body.classList.add("view-mode-mobile");
      document.body.classList.remove("view-mode-desktop");
      if (shell) {
        shell.className = "app-phone-simulator transition-all duration-300";
      }
      if (btnMobile) {
        btnMobile.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow bg-blue-600 text-white active:scale-95";
      }
      if (btnDesktop) {
        btnDesktop.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-gray-300 hover:text-white active:scale-95";
      }
      if (toggleFrameLabel) toggleFrameLabel.textContent = "Bản Máy Tính 💻";
      if (indicator) {
        if (isUser || isSmallScreen) {
          indicator.classList.add("hidden");
        } else {
          indicator.classList.remove("hidden");
          indicator.className = "w-full max-w-7xl mb-3.5 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm border transition bg-gradient-to-r from-blue-900/95 via-[#0d2b5c] to-indigo-950 text-white border-blue-700/60";
          indicator.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="text-xl">📱</span>
              <div>
                <span class="font-extrabold text-yellow-300 uppercase tracking-wide">ĐANG XEM BẢN ĐIỆN THOẠI (DMS MOBILE APP):</span>
                <span class="text-blue-100 ml-1">Mô phỏng 100% ứng dụng di động thực địa cho GSBH & Sales GT. Toàn bộ màn hình nằm trong khung smartphone.</span>
              </div>
            </div>
            <button type="button" onclick="CJApp.setDeviceViewMode('desktop')" class="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition active:scale-95 flex items-center gap-1.5 shadow-sm">
              <span>💻</span>
              <span>Mở Bản Máy Tính ➔</span>
            </button>
          `;
        }
      }
    } else {
      document.body.classList.add("view-mode-desktop");
      document.body.classList.remove("view-mode-mobile");
      if (shell) {
        shell.className = "app-desktop-portal transition-all duration-300";
      }
      if (btnMobile) {
        btnMobile.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-gray-300 hover:text-white active:scale-95";
      }
      if (btnDesktop) {
        btnDesktop.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow bg-blue-600 text-white active:scale-95";
      }
      if (toggleFrameLabel) toggleFrameLabel.textContent = "Bản Điện Thoại 📱";
      if (indicator) {
        if (isUser || isSmallScreen) {
          indicator.classList.add("hidden");
        } else {
          indicator.classList.remove("hidden");
          indicator.className = "w-full max-w-7xl mb-3.5 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm border transition bg-gradient-to-r from-slate-900 via-[#002B49] to-slate-900 text-white border-slate-700";
          indicator.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="text-xl">💻</span>
              <div>
                <span class="font-extrabold text-emerald-400 uppercase tracking-wide">ĐANG XEM BẢN MÁY TÍNH (DMS WEB PORTAL):</span>
                <span class="text-gray-300 ml-1">Giao diện quản lý toàn màn hình mở rộng cho ASM, Admin và Giám Đốc.</span>
              </div>
            </div>
            <button type="button" onclick="CJApp.setDeviceViewMode('mobile')" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow">
              <span>📱</span>
              <span>Chuyển Sang Bản Điện Thoại ➔</span>
            </button>
          `;
        }
      }

      // Initialize map in desktop view
      if (typeof CJAudit !== "undefined" && CJAudit.initGsbhMap) {
        CJAudit.initGsbhMap();
      }
    }

    // Invalidate Leaflet maps after layout animation finishes
    setTimeout(() => {
      if (typeof CJAudit !== "undefined" && CJAudit.gsbhMap) {
        CJAudit.gsbhMap.invalidateSize();
      }
      if (typeof CJDashboard !== "undefined" && CJDashboard.map) {
        CJDashboard.map.invalidateSize();
      }
    }, 350);
  },

  showLoginModal() {
    const modal = document.getElementById("loginModalOverlay");
    if (modal) modal.classList.remove("hidden");
  },

  hideLoginModal() {
    const modal = document.getElementById("loginModalOverlay");
    if (modal) modal.classList.add("hidden");
  },

  bindAuthEvents() {
    // 1-Click Quick GSBH Login buttons
    document.querySelectorAll(".btn-quick-gsbh").forEach(btn => {
      btn.addEventListener("click", () => {
        const username = btn.dataset.username;
        const res = CJAuth.login(username, "123", true);
        if (res.success) {
          this.hideLoginModal();
          this.onUserLoggedIn(res.user);
          CJAudit.showToast(`Đã đăng nhập: ${res.user.name} (${res.user.roleTitle})`, "success");
        }
      });
    });

    // Traditional login form
    const loginForm = document.getElementById("appLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const u = document.getElementById("loginUsername").value;
        const p = document.getElementById("loginPassword").value;
        const remember = document.getElementById("loginRememberMe") ? document.getElementById("loginRememberMe").checked : true;
        const res = CJAuth.login(u, p, remember);
        if (res.success) {
          this.hideLoginModal();
          this.onUserLoggedIn(res.user);
          CJAudit.showToast(`Xin chào, ${res.user.name}!`, "success");
        } else {
          alert(res.message);
        }
      });
    }

    // Logout button on Top Header
    const logoutBtn = document.getElementById("btnLogoutHeader");
    if (logoutBtn) {
      logoutBtn.onclick = (e) => {
        e.preventDefault();
        this.logout();
      };
    }

    // Reset data button
    const btnReset = document.getElementById("btnResetData");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (confirm("Khôi phục toàn bộ danh sách điểm bán và dữ liệu ban đầu cho các GSBH?")) {
          CJStorage.resetAllData();
          CJAudit.renderStoreList();
          CJDashboard.refresh();
          CJAudit.showToast("Đã khôi phục dữ liệu mẫu ban đầu!", "success");
        }
      });
    }

    // Admin Modal Buttons
    const btnUserMgmt = document.getElementById("btnAdminUserManagement");
    if (btnUserMgmt) {
      btnUserMgmt.addEventListener("click", (e) => {
        e.preventDefault();
        this.openAdminUserManagementModal();
      });
    }

    const btnProgReport = document.getElementById("btnAdminProgressReport");
    if (btnProgReport) {
      btnProgReport.addEventListener("click", (e) => {
        e.preventDefault();
        this.openAdminProgressReportModal();
      });
    }
  },

  logout() {
    CJAuth.logout();
    this.adminControlledUser = "ALL";
    document.body.classList.remove("is-user", "is-admin");
    this.showLoginModal();
    const pInput = document.getElementById("loginPassword");
    if (pInput) pInput.value = "";
    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast("Đã đăng xuất thành công! Vui lòng đăng nhập lại.", "info");
    }
  },

  onUserLoggedIn(user) {
    const nameEl = document.getElementById("headerUserName");
    const roleEl = document.getElementById("headerUserRole");
    const avatarEl = document.getElementById("headerUserAvatar");
    const mobileUserEl = document.getElementById("mobileUserName");
    const areaBannerEl = document.getElementById("headerUserAreaBanner");

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = `${user.roleTitle} • ${user.area}`;
    if (avatarEl) avatarEl.textContent = user.avatar || "👮‍♂️";
    if (mobileUserEl) mobileUserEl.textContent = `${user.name} (${user.area.split('(')[0].trim()})`;
    if (areaBannerEl) areaBannerEl.textContent = user.area;
    const dashMobileBadge = document.getElementById("dashMobileGsbhBadge");
    if (dashMobileBadge) dashMobileBadge.textContent = user.name.split(" ").slice(-1)[0] || user.name;

    // Populate profile view fields
    const pName = document.getElementById("profileUserName");
    const pRole = document.getElementById("profileUserRole");
    const pCode = document.getElementById("profileEmpCode");
    const pArea = document.getElementById("profileUserArea");
    if (pName) pName.textContent = user.name;
    if (pRole) pRole.textContent = `${user.roleTitle} (${user.area})`;
    if (pCode) pCode.textContent = user.empCode || "CJ1330714";
    if (pArea) pArea.textContent = user.area;

    // Toggle Admin-exclusive buttons & sections
    const btnAdminExport = document.getElementById("btnAdminExportModal");
    const btnAdminImport = document.getElementById("btnAdminImportModal") || document.getElementById("btnAdminImportHeader");
    const btnAdminExportStores = document.getElementById("btnAdminExportStores");
    const profileAdminSec = document.getElementById("profileAdminSection");
    const importAdminBox = document.getElementById("importAdminAssignBox");
    const adminControlBar = document.getElementById("adminUserControlBar");
    const mainHeader = document.getElementById("mainAppHeader");
    const adminGoogleBar = document.getElementById("adminGoogleSheetDirectBar");
    const deviceIndicator = document.getElementById("deviceModeIndicator");
    const mainTag = document.querySelector("main");

    const isAdmin = CJAuth.isAdmin();

    if (isAdmin) {
      document.body.classList.add("is-admin");
      document.body.classList.remove("is-user");
      if (btnAdminExport) btnAdminExport.classList.remove("hidden");
      if (btnAdminImport) btnAdminImport.classList.remove("hidden");
      if (btnAdminExportStores) btnAdminExportStores.classList.remove("hidden");
      if (profileAdminSec) profileAdminSec.classList.remove("hidden");
      if (importAdminBox) importAdminBox.classList.remove("hidden");
      
      // On desktop (screen >= 768px), show admin bars; on real phones keep clean
      if (window.innerWidth >= 768) {
        if (mainHeader) mainHeader.classList.remove("hidden");
        if (adminControlBar) adminControlBar.classList.remove("hidden");
        if (adminGoogleBar) adminGoogleBar.classList.remove("hidden");
        if (deviceIndicator) deviceIndicator.classList.remove("hidden");
      } else {
        if (mainHeader) mainHeader.classList.add("hidden");
        if (adminControlBar) adminControlBar.classList.add("hidden");
        if (adminGoogleBar) adminGoogleBar.classList.add("hidden");
        if (deviceIndicator) deviceIndicator.classList.add("hidden");
      }

      this.populateAdminActiveUserFilter();

      // Tự động kéo dữ liệu kiểm tra từ Google Sheet về máy Admin (chạy ngầm không làm phiền)
      if (typeof CJCloudSync !== "undefined" && CJCloudSync.syncAllFromCloud) {
        setTimeout(() => {
          CJCloudSync.syncAllFromCloud(true);
        }, 800);
      }
    } else {
      // REGULAR FIELD USER (GSBH / NVBH): CHỈ HIỂN THỊ DUY NHẤT GIAO DIỆN APP ĐIỆN THOẠI (PHẦN KHOANH ĐỎ)
      document.body.classList.add("is-user");
      document.body.classList.remove("is-admin");
      if (mainHeader) mainHeader.classList.add("hidden");
      if (adminControlBar) adminControlBar.classList.add("hidden");
      if (adminGoogleBar) adminGoogleBar.classList.add("hidden");
      if (deviceIndicator) deviceIndicator.classList.add("hidden");
      if (btnAdminExport) btnAdminExport.classList.add("hidden");
      if (btnAdminImport) btnAdminImport.classList.add("hidden");
      if (btnAdminExportStores) btnAdminExportStores.classList.add("hidden");
      if (profileAdminSec) profileAdminSec.classList.add("hidden");
      if (importAdminBox) importAdminBox.classList.add("hidden");

      if (mainTag) {
        mainTag.classList.remove("p-2", "sm:p-4");
        mainTag.classList.add("p-0");
      }
      this.setDeviceViewMode("mobile");
    }

    // Populate NVBH dropdown in Add Store Modal & User selectors
    this.populateSalesSelectorInAddStoreModal();
    this.populateUserSelectors();

    // Initialize modules with the new GSBH context (default to ALL to view all stores)
    CJAudit.selectedSalesRep = "ALL";
    CJAudit.init();
    CJDashboard.init();

    // MÀN HÌNH 1: Mở ngay Dashboard tổng hợp công việc cần kiểm tra theo yêu cầu
    this.switchTab("dashboard");
  },

  togglePasswordVisibility() {
    const p = document.getElementById("loginPassword");
    if (p) {
      p.type = p.type === "password" ? "text" : "password";
    }
  },

  quickLogin(username) {
    const acc = (typeof GSBH_ACCOUNTS !== "undefined") ? GSBH_ACCOUNTS.find(a => a.username === username) : null;
    const uInput = document.getElementById("loginUsername");
    const pInput = document.getElementById("loginPassword");
    if (uInput && acc) uInput.value = acc.empCode || acc.username;
    if (pInput) pInput.value = "123";

    const res = CJAuth.login(username, "123", true);
    if (res.success) {
      this.hideLoginModal();
      this.onUserLoggedIn(res.user);
      CJAudit.showToast(`Đã đăng nhập: ${res.user.name} (${res.user.roleTitle})`, "success");
    }
  },

  startAuditFromDashboard(storeId) {
    this.switchTab("mobileAudit");
    setTimeout(() => {
      CJAudit.selectStore(storeId);
    }, 120);
  },

  populateSalesSelectorInAddStoreModal() {
    const select = document.getElementById("newStoreSalesRep");
    if (!select) return;

    const teamReps = CJAuth.getCurrentTeamSalesReps();
    select.innerHTML = teamReps.map(s => 
      `<option value="${s.username}">${s.name} (${s.code} - ${s.route})</option>`
    ).join("");
  },

  bindNavigation() {
    document.querySelectorAll(".app-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    document.querySelectorAll(".mobile-bottom-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    const views = ["mobileAudit", "dashboard", "auditLog", "tickets", "stores", "promotions", "products", "profile"];
    views.forEach(v => {
      const el = document.getElementById(`view_${v}`);
      if (el) el.classList.add("hidden");
    });

    const targetEl = document.getElementById(`view_${tabId}`);
    if (targetEl) targetEl.classList.remove("hidden");

    document.querySelectorAll(".app-nav-btn").forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add("bg-cj-redDark", "text-white");
        btn.classList.remove("text-gray-200", "hover:bg-gray-800");
      } else {
        btn.classList.remove("bg-cj-redDark", "text-white");
        btn.classList.add("text-gray-200", "hover:bg-gray-800");
      }
    });

    document.querySelectorAll(".mobile-bottom-nav-btn").forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add("text-cj-red", "font-bold");
        btn.classList.remove("text-gray-500");
      } else {
        btn.classList.remove("text-cj-red", "font-bold");
        btn.classList.add("text-gray-500");
      }
    });

    document.querySelectorAll(".mobile-dms-tab").forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add("text-[#184594]", "font-black");
        btn.classList.remove("text-gray-500");
      } else {
        btn.classList.remove("text-[#184594]", "font-black");
        btn.classList.add("text-gray-500");
      }
    });

    if (tabId === "dashboard") {
      setTimeout(() => {
        if (CJDashboard.map) CJDashboard.map.invalidateSize();
        CJDashboard.refresh();
      }, 150);
    } else if (tabId === "mobileAudit") {
      CJAudit.renderStoreList();
    } else if (tabId === "auditLog") {
      CJDashboard.renderAuditTable();
    } else if (tabId === "tickets") {
      CJDashboard.renderTicketsTable();
    } else if (tabId === "stores") {
      CJDashboard.renderStoreManagementTable();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  toggleMobileFrame() {
    const container = document.getElementById("mobileAuditContainer");
    const toggleBtn = document.getElementById("btnToggleFrame");
    if (!container) return;

    if (container.classList.contains("max-w-md")) {
      container.classList.remove("max-w-md", "shadow-2xl", "rounded-2xl", "border-4", "border-gray-800");
      container.classList.add("max-w-4xl");
      if (toggleBtn) toggleBtn.textContent = "📱 Thu gọn chuẩn Mobile";
    } else {
      container.classList.add("max-w-md", "shadow-2xl", "rounded-2xl", "border-4", "border-gray-800");
      container.classList.remove("max-w-4xl");
      if (toggleBtn) toggleBtn.textContent = "💻 Mở rộng màn hình";
    }
  },

  openAddStoreModal() {
    const modal = document.getElementById("addStoreModal");
    if (modal) {
      this.populateSalesSelectorInAddStoreModal();
      modal.classList.remove("hidden");
    }
  },

  closeAddStoreModal() {
    const modal = document.getElementById("addStoreModal");
    if (modal) modal.classList.add("hidden");
  },

  saveNewStore(event) {
    event.preventDefault();
    const currentUser = CJAuth.getCurrentUser();
    const name = document.getElementById("newStoreName")?.value;
    const channel = document.getElementById("newStoreChannel")?.value || "GT";
    const route = document.getElementById("newStoreRoute")?.value || "Tuyến Mới";
    const address = document.getElementById("newStoreAddress")?.value || "TP.HCM";
    const phone = document.getElementById("newStorePhone")?.value || "";
    const freezerTag = document.getElementById("newStoreFreezerTag")?.value || "";
    const assignedUser = document.getElementById("newStoreSalesRep")?.value;

    const teamReps = CJAuth.getCurrentTeamSalesReps();
    const rep = teamReps.find(r => r.username === assignedUser) || teamReps[0] || { username: "hung.nv", name: "Nguyễn Văn Hùng", code: "NV01", phone: "0903 123 456" };

    if (!name) {
      alert("Vui lòng nhập tên điểm bán!");
      return;
    }

    const newId = `STR-${channel}-${Math.floor(100 + Math.random() * 900)}`;
    const newFreezerId = `FZ-CJ-${Math.floor(100 + Math.random() * 900)}`;

    const newStore = {
      id: newId,
      name: name,
      channel: channel,
      route: route,
      address: address,
      phone: phone,
      owner: "Chủ cửa hàng",
      gsbhUsername: currentUser ? currentUser.username : "gsbh.bao",
      gsbhName: currentUser ? currentUser.name : "Trần Quốc Bảo",
      salesRepCode: rep.code,
      salesRep: rep.name,
      salesRepPhone: rep.phone,
      assignedUser: rep.username,
      lat: 10.78 + (Math.random() - 0.5) * 0.08,
      lng: 106.68 + (Math.random() - 0.5) * 0.08,
      freezerId: newFreezerId,
      status: "good",
      lastAuditDate: "Mới thêm",
      lastTemp: -18,
      lastScore: 100
    };

    const newFreezer = {
      id: newFreezerId,
      assetTag: freezerTag || `CJF-FZ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      qrCode: `CJF_FREEZER_${newFreezerId}`,
      brandAssigned: "Bibigo",
      model: "Sanaky VH-3899K (350L Lùa cong)",
      capacity: "350 Lít",
      serialNumber: `SNK2026${Date.now().toString().slice(-4)}`,
      installationDate: new Date().toLocaleDateString("vi-VN"),
      assignedStoreId: newId,
      lastTemperature: -18,
      status: "good"
    };

    const freezers = CJStorage.getFreezers();
    freezers.unshift(newFreezer);
    localStorage.setItem(CJStorage.KEYS.FREEZERS, JSON.stringify(freezers));

    CJStorage.addStore(newStore);
    this.closeAddStoreModal();
    CJAudit.renderStoreList();
    CJDashboard.refresh();
    CJAudit.showToast(`Đã thêm điểm bán "${name}" vào danh sách của bạn!`, "success");
  },

  openImportModal(prefillUser) {
    this.populateUserSelectors();
    const select = document.getElementById("importTargetUserSelect");
    if (select) {
      if (prefillUser && prefillUser !== "AUTO") {
        select.value = prefillUser;
      } else if (this.adminControlledUser && this.adminControlledUser !== "ALL") {
        select.value = this.adminControlledUser;
      } else {
        select.value = "AUTO";
      }
    }
    const modal = document.getElementById("importExcelModal");
    if (modal) modal.classList.remove("hidden");
  },

  closeImportModal() {
    const modal = document.getElementById("importExcelModal");
    if (modal) modal.classList.add("hidden");
  },

  populateUserSelectors() {
    const importSelect = document.getElementById("importTargetUserSelect");
    const exportSelect = document.getElementById("exportTargetUserSelect");
    const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : (typeof GSBH_ACCOUNTS !== "undefined" ? GSBH_ACCOUNTS : []);

    let options = "";
    // 1. Group GSBH
    const gsbhList = allUsers.filter(g => g.role === "gsbh_gt" || g.role === "sup" || g.role === "asm");
    if (gsbhList.length > 0) {
      options += `<optgroup label="👮‍♂️ Giám Sát Bán Hàng (GSBH Kênh GT)">`;
      gsbhList.forEach(g => {
        const areaLabel = g.area ? g.area.split('(')[0].trim() : "Toàn quốc";
        options += `<option value="${g.username}">👮‍♂️ GSBH: ${g.name} (${g.username} - ${areaLabel})</option>`;
      });
      options += `</optgroup>`;
    }

    // 2. Group Sales Reps
    const allReps = CJAuth.getAllSalesReps();
    if (allReps.length > 0) {
      options += `<optgroup label="👤 Nhân Viên Bán Hàng (Sales Rep - GT)">`;
      allReps.forEach(r => {
        options += `<option value="${r.username}">👤 NVBH: ${r.name} (${r.code} - ${r.username} - GSBH: ${r.gsbhName})</option>`;
      });
      options += `</optgroup>`;
    }

    if (importSelect) {
      importSelect.innerHTML = `<option value="AUTO">📁 Tự động gán theo file Excel (User / Ma_NVBH)</option>` + options;
    }
    if (exportSelect) {
      exportSelect.innerHTML = `<option value="ALL">🌐 Tất Cả User / Toàn Quốc (Toàn bộ GSBH & Sales)</option>` + options;
    }
  },

  populateAdminActiveUserFilter() {
    const select = document.getElementById("adminActiveUserFilter");
    if (!select) return;

    const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : (typeof GSBH_ACCOUNTS !== "undefined" ? GSBH_ACCOUNTS : []);

    let html = `<option value="ALL">🌐 Toàn Quốc (Tất Cả User Hệ Thống)</option>`;

    const gsbhList = allUsers.filter(g => g.role === "gsbh_gt" || g.role === "sup" || g.role === "asm");
    if (gsbhList.length > 0) {
      html += `<optgroup label="👮‍♂️ Giám Sát Bán Hàng (GSBH Kênh GT)">`;
      gsbhList.forEach(g => {
        const storeCount = CJStorage.getStoresForUser(g.username).length;
        html += `<option value="${g.username}">👮‍♂️ GSBH ${g.name} (${g.username} - ${storeCount} KH)</option>`;
      });
      html += `</optgroup>`;
    }

    const allReps = CJAuth.getAllSalesReps();
    if (allReps.length > 0) {
      html += `<optgroup label="👤 Nhân Viên Bán Hàng (Sales Rep - GT)">`;
      allReps.forEach(r => {
        const storeCount = CJStorage.getStoresForUser(r.username).length;
        html += `<option value="${r.username}">👤 NVBH ${r.name} (${r.code} - ${storeCount} KH)</option>`;
      });
      html += `</optgroup>`;
    }

    select.innerHTML = html;
    select.value = this.adminControlledUser || "ALL";

    const badge = document.getElementById("adminControlledUserBadge");
    if (badge) {
      if (this.adminControlledUser === "ALL") {
        badge.textContent = "Đang xem: Toàn Quốc";
      } else {
        const found = allUsers.find(g => g.username === this.adminControlledUser) || allReps.find(r => r.username === this.adminControlledUser);
        badge.textContent = `Đang điều khiển: ${found ? found.name : this.adminControlledUser}`;
      }
    }
  },

  onAdminSwitchUser(selectedUser) {
    this.adminControlledUser = selectedUser || "ALL";

    const filterEl = document.getElementById("adminActiveUserFilter");
    if (filterEl && filterEl.value !== this.adminControlledUser) {
      filterEl.value = this.adminControlledUser;
    }

    const badge = document.getElementById("adminControlledUserBadge");
    let targetName = "Toàn Quốc (Tất cả User)";
    if (this.adminControlledUser !== "ALL") {
      const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : GSBH_ACCOUNTS;
      const allReps = CJAuth.getAllSalesReps();
      const found = allUsers.find(g => g.username === this.adminControlledUser) || allReps.find(r => r.username === this.adminControlledUser);
      targetName = found ? found.name : this.adminControlledUser;
    }
    if (badge) {
      badge.textContent = `Đang điều khiển: ${targetName}`;
    }

    // Refresh context
    this.populateSalesSelectorInAddStoreModal();
    if (typeof CJAudit !== "undefined") {
      CJAudit.selectedSalesRep = "ALL";
      CJAudit.populateSalesRepFilter();
    }
    if (typeof CJDashboard !== "undefined") {
      CJDashboard.populateSalesFilterDropdown();
      CJDashboard.refresh();
    }
    if (typeof CJAudit !== "undefined") {
      CJAudit.renderStoreList();
      if (CJAudit.initGsbhMap) CJAudit.initGsbhMap();
      if (CJAudit.showToast) {
        CJAudit.showToast(`👑 Admin đang điều khiển góc nhìn: ${targetName}`, "success");
      }
    }
  },

  clearTestAudits() {
    const totalAudits = (typeof CJStorage !== "undefined" && CJStorage.getAudits) ? CJStorage.getAudits().length : 0;
    const totalTickets = (typeof CJStorage !== "undefined" && CJStorage.getTickets) ? CJStorage.getTickets().length : 0;

    const msg = `⚠️ XÁC NHẬN XÓA TOÀN BỘ DỮ LIỆU ĐÃ TEST?\n\n` +
      `• Hiện có: ${totalAudits} biên bản kiểm tra và ${totalTickets} ticket sự cố test.\n` +
      `• Toàn bộ biên bản kiểm tra & Ticket sự cố test sẽ được xóa sạch.\n` +
      `• 100% Danh sách Khách Hàng và Tài Khoản đăng nhập vẫn được GIỮ NGUYÊN AN TOÀN.\n` +
      `• Trạng thái các điểm bán sẽ được đưa về: "Chưa kiểm tra".\n\n` +
      `Bấm [OK] để tiến hành xóa dữ liệu test.`;

    if (!confirm(msg)) return;

    if (typeof CJStorage !== "undefined" && CJStorage.clearAuditsAndTickets) {
      CJStorage.clearAuditsAndTickets();
    }

    if (typeof CJAudit !== "undefined" && CJAudit.renderStoreList) {
      CJAudit.renderStoreList();
    }
    if (typeof CJDashboard !== "undefined" && CJDashboard.refresh) {
      CJDashboard.refresh();
    }

    alert("✅ ĐÃ XÓA SẠCH DỮ LIỆU KIỂM TRA TEST!\n\nToàn bộ các điểm bán đã được đưa về trạng thái 'Chưa kiểm tra'. Danh sách khách hàng và tài khoản đăng nhập vẫn được giữ nguyên vẹn 100%.");
  },

  clearAllStoresAndReupload() {
    const allStores = (typeof CJStorage !== "undefined" && CJStorage.getAllStores) ? CJStorage.getAllStores() : [];
    const totalStores = allStores.length;
    const msg = `⚠️ XÁC NHẬN XÓA HẾT TOÀN BỘ ${totalStores} ĐIỂM BÁN HIỆN TẠI ĐỂ UPLOAD LẠI?\n\n` +
      `• Toàn bộ danh sách điểm bán và tủ đông hiện tại sẽ được XÓA SẠCH (về 0 điểm bán).\n` +
      `• Các biên bản kiểm tra & Ticket sự cố cũ cũng sẽ được xóa sạch.\n` +
      `• Các tài khoản đăng nhập (Admin, GSBH, NVBH) VẪN ĐƯỢC BẢO LƯU NGUYÊN VẸN 100%.\n` +
      `• Ngay sau khi xóa, cửa sổ Upload file Excel sẽ tự động mở ra để bạn chọn file danh sách mới.\n\n` +
      `Bấm [OK] để tiến hành xóa sạch và nạp lại.`;

    if (!confirm(msg)) return;

    if (typeof CJStorage !== "undefined" && CJStorage.clearAllStores) {
      CJStorage.clearAllStores();
    }

    if (typeof CJAudit !== "undefined" && CJAudit.renderStoreList) {
      CJAudit.renderStoreList();
    }
    if (typeof CJDashboard !== "undefined" && CJDashboard.refresh) {
      CJDashboard.refresh();
    }

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast("Đã xóa sạch toàn bộ điểm bán! Mời bạn chọn file Excel để nạp mới.", "info");
    }

    setTimeout(() => {
      this.openImportModal();
    }, 350);
  },

  openAdminUserManagementModal() {
    const modal = document.getElementById("modalAdminUserManagement");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
    try {
      this.renderAdminUserManagementTable();
    } catch (e) {
      console.error("Error rendering user management table:", e);
    }
  },

  closeAdminUserManagementModal() {
    const modal = document.getElementById("modalAdminUserManagement");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  },

  adminProgressSearchQuery: "",
  adminProgressStatusFilter: "ALL",
  adminProgressRoleFilter: "ALL",

  openAdminProgressReportModal() {
    const modal = document.getElementById("modalAdminProgressReport");
    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }

    try {
      this.adminProgressSearchQuery = "";
      this.adminProgressStatusFilter = "ALL";
      this.adminProgressRoleFilter = "ALL";

      const searchInput = document.getElementById("adminProgressSearchInput");
      if (searchInput) searchInput.value = "";
      const statusSelect = document.getElementById("adminProgressStatusFilter");
      if (statusSelect) statusSelect.value = "ALL";
      const roleSelect = document.getElementById("adminProgressRoleFilter");
      if (roleSelect) roleSelect.value = "ALL";

      this.renderAdminProgressReportTable();
    } catch (e) {
      console.error("Error rendering admin progress report table:", e);
    }
  },

  closeAdminProgressReportModal() {
    const modal = document.getElementById("modalAdminProgressReport");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  },

  onAdminProgressSearch(query) {
    this.adminProgressSearchQuery = String(query || "").trim().toLowerCase();
    this.renderAdminProgressReportTable();
  },

  onAdminProgressFilterStatus(status) {
    this.adminProgressStatusFilter = status || "ALL";
    this.renderAdminProgressReportTable();
  },

  onAdminProgressFilterRole(role) {
    this.adminProgressRoleFilter = role || "ALL";
    this.renderAdminProgressReportTable();
  },

  renderAdminProgressReportTable() {
    const tbody = document.getElementById("adminProgressReportTableBody");
    if (!tbody) return;

    const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : GSBH_ACCOUNTS;
    const isSearch = !!this.adminProgressSearchQuery;
    const q = this.adminProgressSearchQuery;

    // Calculate stats for all users
    const userStatsList = allUsers.map(u => {
      const stats = (typeof CJStorage !== "undefined" && CJStorage.getUserAuditStats)
        ? CJStorage.getUserAuditStats(u.username)
        : { totalStores: 0, auditedStores: 0, unauditedStores: 0, completionRate: 0, goodCount: 0, abnormalCount: 0, auditsCount: 0, lastAuditTime: null };
      return { user: u, stats };
    });

    // Compute Overall KPI Card Metrics
    const operationalUsers = userStatsList.filter(item => item.user.role !== "admin");
    const totalOpsCount = operationalUsers.length;
    const activeAuditorsCount = operationalUsers.filter(item => item.stats.auditedStores > 0).length;
    const inactiveAuditorsCount = operationalUsers.filter(item => item.stats.auditedStores === 0 && item.stats.totalStores > 0).length;

    // National audited stores total
    const allStores = (typeof CJStorage !== "undefined" && CJStorage.getAllStores) ? CJStorage.getAllStores() : [];
    const totalStoresNat = allStores.length;
    const auditedStoresNat = allStores.filter(s => s.isAudited || (s.lastAuditDate && s.lastAuditDate !== "Chưa kiểm tra")).length;
    const natRate = totalStoresNat > 0 ? Math.round((auditedStoresNat / totalStoresNat) * 100) : 0;

    // Update KPI Card DOM
    const elTotalStaff = document.getElementById("kpiReportTotalStaff");
    if (elTotalStaff) elTotalStaff.textContent = `${totalOpsCount} nhân sự`;
    const elActiveStaff = document.getElementById("kpiReportActiveStaff");
    if (elActiveStaff) elActiveStaff.textContent = `${activeAuditorsCount} người`;
    const elInactiveStaff = document.getElementById("kpiReportInactiveStaff");
    if (elInactiveStaff) elInactiveStaff.textContent = `${inactiveAuditorsCount} người`;
    const elNatProgress = document.getElementById("kpiReportNatProgress");
    if (elNatProgress) elNatProgress.textContent = `${auditedStoresNat}/${totalStoresNat} KH (${natRate}%)`;

    // Filter table list
    let filtered = userStatsList.filter(item => {
      const u = item.user;
      const s = item.stats;

      // Role filter
      if (this.adminProgressRoleFilter === "GSBH" && !(u.role === "gsbh_gt" || u.role === "sup" || u.role === "asm")) return false;
      if (this.adminProgressRoleFilter === "NVBH" && u.role !== "sales_rep") return false;
      if (this.adminProgressRoleFilter === "ADMIN" && u.role !== "admin") return false;

      // Status filter
      if (this.adminProgressStatusFilter === "COMPLETED" && s.completionRate < 100) return false;
      if (this.adminProgressStatusFilter === "IN_PROGRESS" && (s.auditedStores === 0 || s.completionRate === 100)) return false;
      if (this.adminProgressStatusFilter === "NOT_STARTED" && s.auditedStores > 0) return false;

      // Search filter
      if (isSearch) {
        const matchName = (u.name || "").toLowerCase().includes(q);
        const matchUser = (u.username || "").toLowerCase().includes(q);
        const matchCode = (u.empCode || "").toLowerCase().includes(q);
        const matchArea = (u.area || "").toLowerCase().includes(q);
        const matchRoute = (u.route || "").toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchCode && !matchArea && !matchRoute) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="p-8 text-center text-gray-400 text-xs">
            Không tìm thấy nhân viên nào phù hợp với bộ lọc tìm kiếm!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((item, idx) => {
      const u = item.user;
      const s = item.stats;
      const isAdmin = u.role === "admin";
      const isGsbh = u.role === "gsbh_gt" || u.role === "sup" || u.role === "asm";

      const roleBadgeClass = isAdmin 
        ? 'bg-amber-100 text-amber-900 border border-amber-300' 
        : (isGsbh ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300');

      const isComplete = s.totalStores > 0 && s.completionRate === 100;
      const isInProgress = s.auditedStores > 0 && s.completionRate < 100;

      const progressColor = isComplete ? 'bg-emerald-500' : (isInProgress ? 'bg-blue-600' : 'bg-gray-300');
      const progressBadge = isComplete 
        ? '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">✅ 100% Hoàn Thành</span>' 
        : (isInProgress 
          ? `<span class="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full">⏳ ${s.completionRate}% Đang Làm</span>` 
          : '<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ 0% Chưa Làm</span>');

      return `
        <tr class="border-b border-gray-100 hover:bg-blue-50/40 transition">
          <td class="p-3 text-center text-gray-500 font-bold">${idx + 1}</td>
          <td class="p-3 text-left">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${u.avatar || (isAdmin ? "👑" : (isGsbh ? "👮‍♂️" : "👤"))}</span>
              <div>
                <div class="font-black text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
                  <span>${u.name}</span>
                </div>
                <div class="text-[10px] text-gray-500">Tài khoản: <b class="text-blue-700">${u.username}</b> • Mã: <span class="font-mono text-gray-700">${u.empCode || '---'}</span></div>
              </div>
            </div>
          </td>
          <td class="p-3 text-center">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-black ${roleBadgeClass}">
              ${u.roleTitle || (isAdmin ? "Quản Trị Viên" : (isGsbh ? "GSBH GT" : "NVBH GT"))}
            </span>
          </td>
          <td class="p-3 text-left text-xs text-gray-600">
            <div class="font-semibold text-gray-800">${u.area || "Toàn Quốc"}</div>
            ${u.route ? `<div class="text-[10px] text-blue-600 font-medium">${u.route}</div>` : ''}
          </td>
          <td class="p-3 text-center font-black text-xs text-slate-900">
            ${s.totalStores} KH
          </td>
          <td class="p-3 text-center">
            <div class="flex flex-col items-center">
              <div class="font-black text-xs ${s.auditedStores > 0 ? 'text-emerald-700' : 'text-gray-400'}">
                ${s.auditedStores} KH
              </div>
              <div class="w-24 bg-gray-200 rounded-full h-2 mt-1 overflow-hidden shadow-inner">
                <div class="h-2 rounded-full ${progressColor} transition-all duration-500" style="width: ${s.completionRate}%"></div>
              </div>
              <div class="mt-1">${progressBadge}</div>
            </div>
          </td>
          <td class="p-3 text-center font-bold text-xs ${s.unauditedStores > 0 ? 'text-amber-700' : 'text-gray-400'}">
            ${s.unauditedStores} KH
          </td>
          <td class="p-3 text-center text-[11px]">
            ${s.auditedStores > 0 ? `
              <div class="flex items-center justify-center gap-1.5 font-bold">
                <span class="text-emerald-700">🟢 ${s.goodCount}</span>
                ${s.abnormalCount > 0 ? `<span class="text-rose-600">🔴 ${s.abnormalCount}</span>` : ''}
              </div>
              <div class="text-[9px] text-gray-400 mt-0.5">${s.auditsCount} lượt audit</div>
            ` : `<span class="text-gray-400">---</span>`}
          </td>
          <td class="p-3 text-center text-[11px] text-gray-600">
            ${s.lastAuditTime ? `
              <div class="font-semibold text-slate-800">${String(s.lastAuditTime).split(' ')[0] || s.lastAuditTime}</div>
              <div class="text-[9px] text-gray-400">${String(s.lastAuditTime).split(' ')[1] || ''}</div>
            ` : `<span class="text-gray-400">Chưa kiểm tra</span>`}
          </td>
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" onclick="CJApp.onAdminSwitchUser('${isAdmin ? 'ALL' : u.username}'); CJApp.closeAdminProgressReportModal();" class="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer" title="Điều khiển góc nhìn để xem danh sách điểm bán của user này">
                <span>👁️</span>
                <span>Xem KH</span>
              </button>
              ${!isAdmin ? `
              <button type="button" onclick="CJApp.confirmResetUserAudits('${u.username}', '${u.name}')" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer" title="Reset kết quả kiểm tra của nhân viên này để nhân viên làm lại từ đầu">
                <span>🔄</span>
                <span>Reset KQ</span>
              </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  confirmResetUserAudits(username, userName = "") {
    const stats = (typeof CJStorage !== "undefined" && CJStorage.getUserAuditStats) ? CJStorage.getUserAuditStats(username) : null;
    const auditedCount = stats ? stats.auditedStores : 0;
    const totalCount = stats ? stats.totalStores : 0;
    const displayName = userName || username;

    const msg = `⚠️ XÁC NHẬN RESET KẾT QUẢ KIỂM TRA CHO NHÂN VIÊN?\n\n` +
      `• Nhân sự: ${displayName} (Tài khoản: ${username})\n` +
      `• Hiện đã kiểm tra: ${auditedCount} / ${totalCount} điểm bán (${stats ? stats.completionRate : 0}%)\n` +
      `• Số biên bản audit: ${stats ? stats.auditsCount : 0} biên bản\n\n` +
      `Hành động này sẽ:\n` +
      `1. Đặt lại toàn bộ điểm bán của nhân viên này về trạng thái: "Chưa kiểm tra" (0%).\n` +
      `2. Xóa toàn bộ các biên bản kiểm tra và ticket sự cố đã nộp của nhân viên này.\n` +
      `3. Nhân viên có thể tiến hành kiểm tra lại từ đầu trên ứng dụng.\n` +
      `4. 100% Danh sách khách hàng và tài khoản nhân viên vẫn được BẢO LƯU NGUYÊN VẸN.\n\n` +
      `Bạn có chắc chắn muốn RESET kết quả của ${displayName}?`;

    if (!confirm(msg)) return;

    const result = CJStorage.resetAuditsForUser(username);
    if (result && result.success) {
      this.renderAdminUserManagementTable();
      if (document.getElementById("modalAdminProgressReport") && !document.getElementById("modalAdminProgressReport").classList.contains("hidden")) {
        this.renderAdminProgressReportTable();
      }
      if (typeof CJDashboard !== "undefined" && CJDashboard.refresh) {
        CJDashboard.refresh();
      }
      if (typeof CJAudit !== "undefined" && CJAudit.renderStoreList) {
        CJAudit.renderStoreList();
      }

      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast(`✅ Đã reset kết quả kiểm tra của ${displayName} (${result.resetStoreCount} KH)!`, "success");
      } else {
        alert(`✅ ĐÃ RESET KẾT QUẢ THÀNH CÔNG!\n\n${result.message}`);
      }
    } else {
      alert(`❌ Lỗi khi reset: ${result?.message || "Không xác định"}`);
    }
  },

  async onUserExcelFileSelected(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    try {
      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast("Đang đọc file Excel danh sách User...", "info");
      }
      const res = await CJExcel.processUserExcelUpload(file);
      if (res && res.success) {
        if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
          CJAudit.showToast(res.message, "success");
        } else {
          alert(res.message);
        }
        this.renderAdminUserManagementTable();
        this.populateUserSelectors();
        this.populateAdminActiveUserFilter();
        this.populateSalesSelectorInAddStoreModal();
      } else {
        alert(res ? res.message : "Có lỗi khi nạp file Excel User!");
      }
    } catch (err) {
      alert("Lỗi nạp Excel User: " + (err.message || err));
    } finally {
      input.value = "";
    }
  },

  async syncAuditsFromGoogleSheetManual() {
    const spinners = document.querySelectorAll(".sync-sheet-spinner");
    spinners.forEach(s => s.classList.add("animate-spin"));

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast("🔄 Đang tải toàn bộ dữ liệu kiểm tra từ Google Sheet...", "info");
    }

    try {
      if (typeof CJCloudSync !== "undefined" && CJCloudSync.syncAllFromCloud) {
        const res = await CJCloudSync.syncAllFromCloud(false);
        if (res && res.success) {
          this.renderAdminUserManagementTable();
          if (document.getElementById("modalAdminProgressReport") && !document.getElementById("modalAdminProgressReport").classList.contains("hidden")) {
            this.renderAdminProgressReportTable();
          }
        }
      } else {
        alert("Chức năng đồng bộ chưa được nạp!");
      }
    } catch (err) {
      console.error("Lỗi đồng bộ:", err);
      alert("Lỗi khi đồng bộ Google Sheet: " + (err.message || err));
    } finally {
      spinners.forEach(s => s.classList.remove("animate-spin"));
    }
  },

  onGoogleSheetAuditFileSelected(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (typeof CJExcel !== "undefined" && CJExcel.importAuditsFromExcel) {
      CJExcel.importAuditsFromExcel(file);
    }
    input.value = "";
  },

  resetUsersToAdminOnly() {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ các User và chỉ giữ lại duy nhất tài khoản Quản trị tối cao (admin)?")) {
      return;
    }
    CJStorage.resetUsersToAdminOnly();
    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast("Đã đưa hệ thống về trạng thái chỉ còn duy nhất tài khoản admin!", "success");
    }
    this.adminControlledUser = "ALL";
    this.renderAdminUserManagementTable();
    this.populateUserSelectors();
    this.populateAdminActiveUserFilter();
    this.populateSalesSelectorInAddStoreModal();
  },

  deleteUser(username) {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}" không?`)) return;
    const res = CJStorage.deleteUser(username);
    if (res.success) {
      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast(res.message, "success");
      }
      if (this.adminControlledUser === username) this.adminControlledUser = "ALL";
      this.renderAdminUserManagementTable();
      this.populateUserSelectors();
      this.populateAdminActiveUserFilter();
      this.populateSalesSelectorInAddStoreModal();
    } else {
      alert(res.message);
    }
  },

  async syncFromMasterFolder() {
    try {
      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast("Đang đồng bộ dữ liệu từ thư mục Master/...", "info");
      }

      const [resUsers, resStores] = await Promise.all([
        fetch("./Master/DS%20User.xlsx"),
        fetch("./Master/DSKH%20c%E1%BA%A7n%20check.xlsx")
      ]);

      if (!resUsers.ok || !resStores.ok) {
        throw new Error("Trình duyệt không thể đọc trực tiếp thư mục Master. Hãy nhấp đúp vào file 'dong_bo_master.bat' trong thư mục để tự động đồng bộ ngay!");
      }

      const [bufUsers, bufStores] = await Promise.all([
        resUsers.arrayBuffer(),
        resStores.arrayBuffer()
      ]);

      if (typeof XLSX === "undefined") {
        throw new Error("Thư viện SheetJS chưa sẵn sàng!");
      }

      // Read and import users
      const wbU = XLSX.read(new Uint8Array(bufUsers), { type: "array" });
      const rowsU = XLSX.utils.sheet_to_json(wbU.Sheets[wbU.SheetNames[0]]);
      CJStorage.importBulkUsers(rowsU);

      // Read and import stores & freezers
      const wbS = XLSX.read(new Uint8Array(bufStores), { type: "array" });
      const rowsS = XLSX.utils.sheet_to_json(wbS.Sheets[wbS.SheetNames[0]]);
      const resS = CJStorage.importBulkStoresAndFreezers(rowsS, "AUTO", true);

      // Refresh UI components
      this.renderAdminUserManagementTable();
      this.populateUserSelectors();
      this.populateAdminActiveUserFilter();
      if (typeof CJDashboard !== "undefined" && CJDashboard.render) {
        CJDashboard.render();
      }

      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast(`✅ Đã đồng bộ thành công: ${rowsU.length} User, ${resS.totalStores} KH (${resS.totalFreezers} Tủ đông)!`, "success");
      } else {
        alert(`✅ Đã đồng bộ thành công từ thư mục Master!\n- User: ${rowsU.length} tài khoản\n- Khách hàng: ${resS.totalStores} điểm bán (${resS.totalFreezers} tủ đông)`);
      }
    } catch (err) {
      alert("Thông báo đồng bộ:\n" + (err.message || err));
    }
  },

  exportDataJsForGitHub() {
    try {
      const users = CJStorage.getUsers();
      const stores = CJStorage.getAllStores();
      const freezers = CJStorage.getFreezers();
      const savedGoogleSheetUrl = localStorage.getItem("cj_google_sheet_url") || (typeof CJ_SYSTEM_GOOGLE_SHEET_URL !== "undefined" ? CJ_SYSTEM_GOOGLE_SHEET_URL : "");

      const fileContent = `/**
 * CJ MarketAudit - Comprehensive FMCG Master Database for CJ Foods Vietnam
 * Official Master Data: ${users.length} Accounts, ${stores.length} Outlets, ${freezers.length} Freezers
 * Auto-embedded for GitHub Pages & Offline Field Audits
 */

const CJ_SYSTEM_GOOGLE_SHEET_URL = ${JSON.stringify(savedGoogleSheetUrl || "")};

const GSBH_ACCOUNTS = ${JSON.stringify(users, null, 2)};

const INITIAL_STORES = ${JSON.stringify(stores, null, 2)};

const INITIAL_FREEZERS = ${JSON.stringify(freezers, null, 2)};

const INITIAL_AUDITS = [];

${typeof CJ_PRODUCTS !== "undefined" ? "const CJ_PRODUCTS = " + JSON.stringify(CJ_PRODUCTS, null, 2) + ";" : ""}
${typeof CJ_PROMOTIONS !== "undefined" ? "const CJ_PROMOTIONS = " + JSON.stringify(CJ_PROMOTIONS, null, 2) + ";" : ""}
`;

      const blob = new Blob([fileContent], { type: "application/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "data.js";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast("Đã tải xuống file data.js! Hãy ghi đè vào thư mục js/data.js và commit lên GitHub.", "success");
      } else {
        alert("Đã tải xuống file data.js! Hãy copy vào thư mục js/ và commit lên GitHub.");
      }
    } catch (err) {
      alert("Lỗi xuất file data.js: " + (err.message || err));
    }
  },

  renderAdminUserManagementTable() {
    const tbody = document.getElementById("adminUserTableBody");
    if (!tbody) return;

    const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : GSBH_ACCOUNTS;

    tbody.innerHTML = allUsers.map(u => {
      const isControlled = (this.adminControlledUser === u.username) || (u.role === "admin" && this.adminControlledUser === "ALL");
      const isAdmin = u.role === "admin";
      const isGsbh = u.role === "gsbh_gt" || u.role === "sup" || u.role === "asm";

      const stats = (typeof CJStorage !== "undefined" && CJStorage.getUserAuditStats)
        ? CJStorage.getUserAuditStats(u.username)
        : { totalStores: 0, auditedStores: 0, unauditedStores: 0, completionRate: 0, goodCount: 0, abnormalCount: 0, auditsCount: 0, lastAuditTime: null };

      const roleBadgeClass = isAdmin 
        ? 'bg-amber-100 text-amber-900 border border-amber-300' 
        : (isGsbh ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300');

      return `
        <tr class="border-b border-gray-100 hover:bg-amber-50/50 transition">
          <td class="p-3 text-left">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${u.avatar || (isAdmin ? "👑" : (isGsbh ? "👮‍♂️" : "👤"))}</span>
              <div>
                <div class="font-black text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
                  <span>${u.name}</span>
                  ${isControlled ? `<span class="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded">ĐANG ĐIỀU KHIỂN</span>` : ''}
                </div>
                <div class="text-[10px] text-gray-500">Tài khoản: <b class="text-blue-700">${u.username}</b> ${u.phone ? `• SĐT: ${u.phone}` : ''}</div>
              </div>
            </div>
          </td>
          <td class="p-3 text-center font-bold text-gray-800 text-xs">
            <span class="bg-gray-100 px-2 py-0.5 rounded-md font-mono text-[11px] text-gray-700">${u.empCode || "---"}</span>
          </td>
          <td class="p-3 text-center">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-black ${roleBadgeClass}">
              ${u.roleTitle || (isAdmin ? "Quản Trị Viên" : (isGsbh ? "GSBH Kênh GT" : "NVBH GT"))}
            </span>
          </td>
          <td class="p-3 text-left text-xs text-gray-600">
            <div class="font-semibold text-gray-800">${u.area || "Toàn Quốc"}</div>
            ${u.route ? `<div class="text-[10px] text-blue-600 font-medium">${u.route}</div>` : ''}
          </td>
          <td class="p-3 text-left text-xs">
            ${u.manager ? `<span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-semibold text-[10px]">${u.manager}</span>` : `<span class="text-gray-400 text-[10px]">${isAdmin ? "Cấp cao nhất" : "Trực tiếp"}</span>`}
          </td>
          <td class="p-3 text-center font-black text-xs text-[#184594]">
            ${stats.totalStores} KH
          </td>
          <td class="p-3 text-center">
            <div class="flex flex-col items-center min-w-[110px]">
              <div class="flex items-center gap-1 font-black text-xs ${stats.auditedStores > 0 ? 'text-emerald-700' : 'text-gray-500'}">
                <span>${stats.auditedStores}/${stats.totalStores}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold ${stats.completionRate === 100 ? 'bg-emerald-100 text-emerald-800' : (stats.completionRate > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600')}">
                  ${stats.completionRate}%
                </span>
              </div>
              <div class="w-20 bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                <div class="h-1.5 rounded-full ${stats.completionRate === 100 ? 'bg-emerald-500' : (stats.completionRate > 0 ? 'bg-blue-600' : 'bg-gray-300')}" style="width: ${stats.completionRate}%"></div>
              </div>
              <div class="text-[9px] text-gray-400 mt-0.5">
                ${stats.auditsCount} lượt audit ${stats.lastAuditTime ? `• ${String(stats.lastAuditTime).split(' ')[0] || ''}` : ''}
              </div>
            </div>
          </td>
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" onclick="CJApp.openEditUserModal('${u.username}')" class="px-2 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition cursor-pointer flex items-center gap-1 active:scale-95" title="Chỉnh sửa thông tin user này">
                <span>✏️</span>
                <span>Sửa</span>
              </button>
              <button type="button" onclick="CJApp.openImportModal('${isAdmin ? 'AUTO' : u.username}'); CJApp.closeAdminUserManagementModal();" class="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer" title="Upload file Excel danh sách khách hàng gán cho user này">
                <span>📂</span>
                <span>Nạp KH</span>
              </button>
              <button type="button" onclick="CJApp.onAdminSwitchUser('${isAdmin ? 'ALL' : u.username}'); CJApp.closeAdminUserManagementModal();" class="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer" title="Điều khiển góc nhìn user này">
                <span>👁️</span>
                <span>Điều khiển</span>
              </button>
              ${!isAdmin ? `
              <button type="button" onclick="CJApp.confirmResetUserAudits('${u.username}', '${u.name}')" class="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition cursor-pointer flex items-center gap-1 active:scale-95" title="Reset kết quả kiểm tra của riêng user này về 0">
                <span>🔄</span>
                <span>Reset KQ</span>
              </button>
              ` : ''}
              <button type="button" onclick="CJApp.openChangePasswordModal('${u.username}')" class="px-2 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition cursor-pointer" title="Đổi mật khẩu">
                <span>🔑</span>
              </button>
              ${!isAdmin ? `
              <button type="button" onclick="CJApp.deleteUser('${u.username}')" class="px-2 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs transition cursor-pointer" title="Xóa tài khoản này">
                <span>🗑️</span>
              </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openEditUserModal(username) {
    if (!username) return;
    const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : (typeof GSBH_ACCOUNTS !== "undefined" ? GSBH_ACCOUNTS : []);
    const user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      alert(`Không tìm thấy người dùng "${username}"!`);
      return;
    }

    const modal = document.getElementById("modalEditUser");
    if (!modal) return;

    // Populate Manager dropdown
    const mgrSelect = document.getElementById("editUserManager");
    if (mgrSelect) {
      let mgrHtml = `<option value="">-- Cấp cao nhất / Không có --</option>`;
      mgrHtml += `<option value="admin" ${user.manager === 'admin' ? 'selected' : ''}>👑 Quản Trị Viên (admin)</option>`;
      allUsers.filter(u => u.username !== user.username && (u.role === "gsbh_gt" || u.role === "sup" || u.role === "asm" || u.role === "admin")).forEach(m => {
        if (m.username !== "admin") {
          mgrHtml += `<option value="${m.username}" ${user.manager === m.username ? 'selected' : ''}>${m.avatar || '👮‍♂️'} ${m.name} (${m.username})</option>`;
        }
      });
      mgrSelect.innerHTML = mgrHtml;
    }

    // Custom password if any
    const customPasswords = (typeof CJAuth !== "undefined" && CJAuth.getCustomPasswords) ? CJAuth.getCustomPasswords() : {};
    const pass = customPasswords[user.username] || user.password || "123";

    // Fill inputs
    const origInput = document.getElementById("editUserOriginalUsername");
    if (origInput) origInput.value = user.username;
    const nameInput = document.getElementById("editUserName");
    if (nameInput) nameInput.value = user.name || "";
    const userInput = document.getElementById("editUserUsername");
    if (userInput) userInput.value = user.username || "";
    const codeInput = document.getElementById("editUserEmpCode");
    if (codeInput) codeInput.value = user.empCode || "";
    const passInput = document.getElementById("editUserPassword");
    if (passInput) passInput.value = pass;
    const roleSelect = document.getElementById("editUserRole");
    if (roleSelect) roleSelect.value = user.role || "gsbh_gt";
    const chanSelect = document.getElementById("editUserChannel");
    if (chanSelect) chanSelect.value = user.channel || "GT";
    const areaInput = document.getElementById("editUserArea");
    if (areaInput) areaInput.value = user.area || "";
    const routeInput = document.getElementById("editUserRoute");
    if (routeInput) routeInput.value = user.route || "";
    const phoneInput = document.getElementById("editUserPhone");
    if (phoneInput) phoneInput.value = user.phone || "";
    const emailInput = document.getElementById("editUserEmail");
    if (emailInput) emailInput.value = user.email || "";

    // Show/hide admin note if user is admin
    const adminNote = document.getElementById("editUserAdminNote");
    if (user.role === "admin") {
      if (adminNote) adminNote.classList.remove("hidden");
      if (roleSelect) roleSelect.disabled = true;
    } else {
      if (adminNote) adminNote.classList.add("hidden");
      if (roleSelect) roleSelect.disabled = false;
    }

    modal.classList.remove("hidden");
  },

  closeEditUserModal() {
    const modal = document.getElementById("modalEditUser");
    if (modal) modal.classList.add("hidden");
  },

  submitEditUser(e) {
    e.preventDefault();
    const origUsername = document.getElementById("editUserOriginalUsername")?.value;
    const name = document.getElementById("editUserName")?.value?.trim();
    const newUsername = document.getElementById("editUserUsername")?.value?.trim();
    const empCode = document.getElementById("editUserEmpCode")?.value?.trim();
    const password = document.getElementById("editUserPassword")?.value?.trim();
    const roleSelect = document.getElementById("editUserRole");
    const role = roleSelect ? roleSelect.value : "gsbh_gt";
    const channel = document.getElementById("editUserChannel")?.value || "GT";
    const area = document.getElementById("editUserArea")?.value?.trim() || "";
    const route = document.getElementById("editUserRoute")?.value?.trim() || "";
    const phone = document.getElementById("editUserPhone")?.value?.trim() || "";
    const email = document.getElementById("editUserEmail")?.value?.trim() || "";
    const manager = document.getElementById("editUserManager")?.value?.trim() || "";

    if (!name) {
      alert("Vui lòng nhập Họ và tên!");
      return;
    }
    if (!newUsername) {
      alert("Vui lòng nhập Tên đăng nhập (Tài khoản)!");
      return;
    }

    const res = CJStorage.updateUser(origUsername, {
      name,
      username: newUsername,
      empCode,
      password,
      role,
      channel,
      area,
      route,
      phone,
      email,
      manager
    });

    if (res.success) {
      this.closeEditUserModal();
      this.renderAdminUserManagementTable();
      this.populateUserSelectors();
      this.populateAdminActiveUserFilter();
      this.populateSalesSelectorInAddStoreModal();

      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast(res.message, "success");
      } else {
        alert(res.message);
      }
    } else {
      alert(res.message);
    }
  },

  resetUserPassword(username) {
    if (!username) return;
    const res = CJAuth.resetPassword(username);
    if (res.success) {
      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast(res.message, "success");
      } else {
        alert(res.message);
      }
    }
  },

  onSelectUserForPasswordChange(userVal) {
    const uInput = document.getElementById("cpUsername");
    if (uInput) uInput.value = userVal;
  },

  openChangePasswordModal(prefillUsername) {
    const modal = document.getElementById("modalChangePassword");
    const uInput = document.getElementById("cpUsername");
    const uSelect = document.getElementById("cpUsernameSelect");
    const oldP = document.getElementById("cpOldPassword");
    const newP = document.getElementById("cpNewPassword");
    const confP = document.getElementById("cpConfirmPassword");

    // Populate user select in modal
    if (uSelect) {
      const allUsers = (typeof CJStorage !== "undefined" && CJStorage.getUsers) ? CJStorage.getUsers() : (typeof GSBH_ACCOUNTS !== "undefined" ? GSBH_ACCOUNTS : []);
      let opt = `<option value="">-- Chọn tài khoản từ danh sách --</option>`;
      opt += `<option value="admin">👑 Quản Trị Viên (admin)</option>`;
      
      const gsbhList = allUsers.filter(g => g.role === "gsbh_gt" || g.role === "sup" || g.role === "asm");
      if (gsbhList.length > 0) {
        opt += `<optgroup label="👮‍♂️ Giám Sát Bán Hàng">`;
        gsbhList.forEach(g => {
          opt += `<option value="${g.username}">👮‍♂️ ${g.name} (${g.username})</option>`;
        });
        opt += `</optgroup>`;
      }

      const allReps = CJAuth.getAllSalesReps();
      if (allReps.length > 0) {
        opt += `<optgroup label="👤 Nhân Viên Bán Hàng">`;
        allReps.forEach(r => {
          opt += `<option value="${r.username}">👤 ${r.name} (${r.code} - ${r.username})</option>`;
        });
        opt += `</optgroup>`;
      }
      uSelect.innerHTML = opt;
    }

    const currentUser = CJAuth.getCurrentUser();
    const loginUserVal = document.getElementById("loginUsername")?.value;
    const targetUser = prefillUsername || (currentUser ? (currentUser.empCode || currentUser.username) : (loginUserVal || ""));

    if (uInput) uInput.value = targetUser;
    if (uSelect && targetUser) uSelect.value = targetUser;
    if (oldP) oldP.value = "";
    if (newP) newP.value = "";
    if (confP) confP.value = "";

    if (modal) modal.classList.remove("hidden");
  },

  closeChangePasswordModal() {
    const modal = document.getElementById("modalChangePassword");
    if (modal) modal.classList.add("hidden");
  },

  submitChangePassword(e) {
    e.preventDefault();
    const username = document.getElementById("cpUsername")?.value;
    const oldPass = document.getElementById("cpOldPassword")?.value;
    const newPass = document.getElementById("cpNewPassword")?.value;
    const confirmPass = document.getElementById("cpConfirmPassword")?.value;

    if (!username) {
      alert("Vui lòng chọn hoặc nhập tài khoản hoặc mã nhân viên!");
      return;
    }
    if (!newPass || newPass.length < 3) {
      alert("Mật khẩu mới phải có ít nhất 3 ký tự!");
      return;
    }
    if (newPass !== confirmPass) {
      alert("Xác nhận mật khẩu mới không trùng khớp!");
      return;
    }

    const res = CJAuth.changePassword(username, oldPass, newPass);
    if (res.success) {
      this.closeChangePasswordModal();
      if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
        CJAudit.showToast(res.message, "success");
      } else {
        alert(res.message);
      }
      // If login modal is open, auto update password field
      const loginP = document.getElementById("loginPassword");
      if (loginP) loginP.value = newPass;
    } else {
      alert(res.message);
    }
  },

  openAdminExportModal() {
    this.populateUserSelectors();
    const modal = document.getElementById("modalAdminExport");
    if (modal) modal.classList.remove("hidden");
  },

  closeAdminExportModal() {
    const modal = document.getElementById("modalAdminExport");
    if (modal) modal.classList.add("hidden");
  },

  submitAdminExport() {
    const targetUser = document.getElementById("exportTargetUserSelect")?.value || "ALL";
    this.closeAdminExportModal();
    CJExcel.exportAuditReport(targetUser);
  },

  bindImportModalEvents() {
    const fileInput = document.getElementById("excelUploadInput");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const targetUser = document.getElementById("importTargetUserSelect")?.value || "AUTO";
        const replaceAll = document.getElementById("importReplaceAllCheckbox") ? document.getElementById("importReplaceAllCheckbox").checked : false;

        try {
          CJAudit.showToast("Đang nạp file Excel...", "info");
          const result = await CJExcel.processExcelUpload(file, targetUser, replaceAll);
          if (result.count > 0) {
            CJAudit.showToast(`✅ Đã nạp thành công ${result.count} điểm bán!`, "success");
            this.closeImportModal();
            CJAudit.renderStoreList();
            CJDashboard.refresh();
          } else {
            alert("Không tìm thấy dữ liệu hợp lệ trong file Excel!");
          }
        } catch (err) {
          console.error(err);
          alert("Lỗi khi đọc file Excel: " + err.message);
        }
        fileInput.value = "";
      });
    }
  },

  // ================= GOOGLE SHEETS & DRIVE CLOUD SYNC CONFIG =================
  openGoogleSheetConfigModal() {
    const modal = document.getElementById("modalGoogleSheetConfig");
    if (!modal) return;

    const input = document.getElementById("inputGoogleSheetUrl");
    const currentUrl = (typeof CJCloudSync !== "undefined" && CJCloudSync.getScriptUrl) 
      ? CJCloudSync.getScriptUrl() 
      : (localStorage.getItem("cj_google_sheet_url") || "");
    if (input) input.value = currentUrl;

    const statusBadge = document.getElementById("googleSheetStatusBadge");
    if (statusBadge) {
      if (currentUrl) {
        statusBadge.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 font-bold px-2.5 py-1 rounded-full text-xs">🟢 Đang hoạt động: Đã liên kết Google Apps Script</span>`;
      } else {
        statusBadge.innerHTML = `<span class="inline-flex items-center gap-1 text-amber-700 bg-amber-100 font-bold px-2.5 py-1 rounded-full text-xs">⚪ Chưa cấu hình: Dữ liệu hiện chỉ lưu trên trình duyệt cục bộ</span>`;
      }
    }

    const testResult = document.getElementById("googleSheetTestResult");
    if (testResult) {
      testResult.classList.add("hidden");
      testResult.style.display = "none";
      testResult.textContent = "";
    }

    modal.classList.remove("hidden");
    modal.style.display = "flex";
  },

  closeGoogleSheetConfigModal() {
    const modal = document.getElementById("modalGoogleSheetConfig");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  },

  async saveGoogleSheetUrl() {
    const input = document.getElementById("inputGoogleSheetUrl");
    const url = input ? input.value.trim() : "";

    if (typeof CJCloudSync !== "undefined" && CJCloudSync.setScriptUrl) {
      CJCloudSync.setScriptUrl(url);
    } else {
      if (url) localStorage.setItem("cj_google_sheet_url", url);
      else localStorage.removeItem("cj_google_sheet_url");
    }

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast("✅ Đã lưu cấu hình Google Apps Script!", "success");
    } else {
      alert("Đã lưu cấu hình Google Apps Script!");
    }

    this.openGoogleSheetConfigModal();
  },

  async testGoogleSheetConnection() {
    const input = document.getElementById("inputGoogleSheetUrl");
    const url = input ? input.value.trim() : "";
    const testResult = document.getElementById("googleSheetTestResult");

    if (!url) {
      alert("Vui lòng nhập URL Google Apps Script Web App trước khi kiểm tra!");
      return;
    }

    if (testResult) {
      testResult.classList.remove("hidden", "text-red-700", "text-emerald-700", "bg-red-50", "bg-emerald-50");
      testResult.style.display = "block";
      testResult.classList.add("text-blue-700", "bg-blue-50");
      testResult.textContent = "⏳ Đang kết nối thử nghiệm tới Google Apps Script...";
    }

    try {
      if (typeof CJCloudSync !== "undefined" && CJCloudSync.testConnection) {
        const res = await CJCloudSync.testConnection(url);
        if (testResult) {
          testResult.classList.remove("text-blue-700", "bg-blue-50");
          testResult.classList.add("text-emerald-700", "bg-emerald-50");
          testResult.textContent = "✅ " + (res.message || "Kết nối Google Sheets & Drive thành công!");
        }
      } else {
        if (url.includes("script.google.com/macros/s/")) {
          if (testResult) {
            testResult.classList.remove("text-blue-700", "bg-blue-50");
            testResult.classList.add("text-emerald-700", "bg-emerald-50");
            testResult.textContent = "✅ URL Google Apps Script đúng định dạng!";
          }
        }
      }
    } catch (err) {
      if (testResult) {
        testResult.classList.remove("text-blue-700", "bg-blue-50");
        testResult.classList.add("text-red-700", "bg-red-50");
        testResult.textContent = "❌ Thử nghiệm kết nối: " + (err.message || err.toString());
      }
    }
  }
};

// Gắn toàn cục window
if (typeof window !== "undefined") {
  window.CJApp = CJApp;
  window.openGoogleSheetConfigModal = function() {
    CJApp.openGoogleSheetConfigModal();
  };
  window.closeGoogleSheetConfigModal = function() {
    CJApp.closeGoogleSheetConfigModal();
  };
}

window.addEventListener("DOMContentLoaded", () => {
  CJApp.init();
});
