/**
 * CJ MarketAudit - Authentication & Role-Based Access Control
 * Universal FMCG Login for Admin, GSBH, and Sales Reps (NVBH)
 * Auto-normalizes codes (O0321 <-> 0321 <-> 321), unaccented names, and flexible company passwords
 */

const CJAuth = {
  KEY_SESSION: "cj_market_audit_gsbh_session_v4",
  KEY_CUSTOM_PASSWORDS: "cj_market_audit_custom_passwords_v1",

  _memSession: null,
  _memCustomPasswords: null,

  init() {
    // Session initialization
  },

  removeDiacritics(str) {
    if (!str) return "";
    return str.toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  },

  normalizeCode(code) {
    if (!code) return "";
    let s = String(code).trim().toLowerCase();
    if (s.startsWith("o") && /^\d+$/.test(s.slice(1))) {
      s = "0" + s.slice(1);
    }
    // Remove leading zeros in numeric segments: audit01 <-> audit1, 05319 <-> 5319, O0321 <-> 321
    s = s.replace(/0+(\d+)/g, "$1");
    return s;
  },

  getCustomPasswords() {
    if (this._memCustomPasswords) return this._memCustomPasswords;
    try {
      const p = JSON.parse(localStorage.getItem(this.KEY_CUSTOM_PASSWORDS));
      if (p && typeof p === "object") {
        this._memCustomPasswords = p;
        return p;
      }
    } catch (e) {}
    this._memCustomPasswords = {};
    return this._memCustomPasswords;
  },

  getUsersList() {
    let baseList = [];
    if (typeof CJStorage !== "undefined" && typeof CJStorage.getUsers === "function") {
      baseList = CJStorage.getUsers() || [];
    } else if (typeof GSBH_ACCOUNTS !== "undefined" && Array.isArray(GSBH_ACCOUNTS)) {
      baseList = GSBH_ACCOUNTS;
    }

    // Flatten all users: Combine GSBH accounts AND individual Sales Reps (teamSalesReps)
    const combined = [];
    const seenUsernames = new Set();

    // 1. Add direct accounts (Admin, GSBH, etc.)
    baseList.forEach(u => {
      const uKey = (u.username || "").toLowerCase().trim();
      if (uKey && !seenUsernames.has(uKey)) {
        seenUsernames.add(uKey);
        combined.push({
          ...u,
          username: u.username,
          empCode: u.empCode || u.username,
          name: u.name || u.username,
          role: u.role || "gsbh_gt",
          roleTitle: u.roleTitle || (u.role === "admin" ? "Quản Trị Viên (Admin)" : "GSBH Kênh GT"),
          area: u.area || "Toàn Quốc",
          phone: u.phone || "0908 000 000",
          email: u.email || `${u.username}@cjfoods.vn`,
          avatar: u.avatar || (u.role === "admin" ? "👑" : "👮‍♂️"),
          password: u.password || "123",
          teamSalesReps: u.teamSalesReps || []
        });
      }

      // 2. Also register all team sales reps as individual first-class login accounts
      if (Array.isArray(u.teamSalesReps)) {
        u.teamSalesReps.forEach(rep => {
          const rKey = (rep.username || rep.code || "").toLowerCase().trim();
          if (rKey && !seenUsernames.has(rKey)) {
            seenUsernames.add(rKey);
            combined.push({
              username: rep.username || rep.code,
              empCode: rep.code || rep.username,
              name: rep.name || rep.username,
              role: "sales_rep",
              roleTitle: "Nhân Viên Bán Hàng (NVBH - GT)",
              area: u.area || "Toàn Quốc",
              phone: rep.phone || "0901 888 999",
              email: `${rKey}@cjfoods.vn`,
              avatar: "👤",
              password: "123",
              manager: u.username,
              gsbhName: u.name,
              route: rep.route || `Tuyến ${u.name}`,
              teamSalesReps: []
            });
          }
        });
      }
    });

    return combined;
  },

  changePassword(usernameOrEmpCode, oldPassword, newPassword) {
    const cleanUser = (usernameOrEmpCode || "").trim().toLowerCase();
    const cleanOldPass = (oldPassword || "").trim();
    const cleanNewPass = (newPassword || "").trim();

    if (!cleanUser) {
      return { success: false, message: "Vui lòng nhập tên đăng nhập hoặc mã nhân viên!" };
    }
    if (!cleanNewPass || cleanNewPass.length < 3) {
      return { success: false, message: "Mật khẩu mới phải có ít nhất 3 ký tự!" };
    }

    const normInput = this.normalizeCode(cleanUser);
    const unaccentInput = this.removeDiacritics(cleanUser);
    const allUsers = this.getUsersList();

    const matched = allUsers.find(u => {
      const uName = (u.username || "").toLowerCase();
      const uEmp = (u.empCode || "").toLowerCase();
      const normU = this.normalizeCode(uName);
      const normE = this.normalizeCode(uEmp);
      const unaccentName = this.removeDiacritics(u.name || "");

      return uName === cleanUser || 
             uEmp === cleanUser ||
             (normInput && (normU === normInput || normE === normInput)) ||
             unaccentName === unaccentInput ||
             (unaccentInput.length >= 3 && unaccentName.includes(unaccentInput));
    });

    if (!matched) {
      return { success: false, message: `Không tìm thấy tài khoản "${usernameOrEmpCode}" trong hệ thống!` };
    }

    const customPasswords = this.getCustomPasswords();
    const currentPass = customPasswords[matched.username] || matched.password || "123";

    const isCallerAdmin = this.isAdmin();
    if (!isCallerAdmin) {
      const isOldValid = (cleanOldPass === currentPass) || 
                         (cleanOldPass === "123") || 
                         (cleanOldPass === "123456") || 
                         (cleanOldPass === "admin123") || 
                         (cleanOldPass === "cj@2026");
      if (!isOldValid) {
        return { success: false, message: "Mật khẩu cũ không chính xác!" };
      }
    }

    customPasswords[matched.username] = cleanNewPass;
    try {
      localStorage.setItem(this.KEY_CUSTOM_PASSWORDS, JSON.stringify(customPasswords));
    } catch (e) {}

    return { 
      success: true, 
      message: `Đã đổi mật khẩu thành công cho "${matched.name}" (${matched.username})!`,
      user: matched,
      newPassword: cleanNewPass
    };
  },

  resetPassword(username) {
    const customPasswords = this.getCustomPasswords();
    customPasswords[username] = "123";
    try {
      localStorage.setItem(this.KEY_CUSTOM_PASSWORDS, JSON.stringify(customPasswords));
    } catch (e) {}
    return { success: true, message: `Đã khôi phục mật khẩu tài khoản ${username} về mặc định: 123` };
  },

  getCurrentUser() {
    if (this._memSession) return this._memSession;
    try {
      const session = sessionStorage.getItem(this.KEY_SESSION) || localStorage.getItem(this.KEY_SESSION);
      if (session) {
        const u = JSON.parse(session);
        if (u) {
          if (u.username === "admin" && u.name !== "Admin") u.name = "Admin";
          this._memSession = u;
          return u;
        }
      }
    } catch (e) {}
    return null;
  },

  getAllGSBH() {
    const allUsers = this.getUsersList();
    return allUsers.filter(u => u.role === "gsbh_gt" || u.role === "admin" || u.role === "asm" || u.role === "sup");
  },

  getCurrentTeamSalesReps() {
    const user = this.getCurrentUser();
    if (!user) return [];
    const allUsers = this.getUsersList();

    if (user.role === "admin") {
      const controlled = (typeof CJApp !== "undefined" && CJApp.adminControlledUser) ? CJApp.adminControlledUser : "ALL";
      if (controlled !== "ALL") {
        const gsbh = allUsers.find(g => g.username.toLowerCase() === controlled.toLowerCase() || this.normalizeCode(g.username) === this.normalizeCode(controlled));
        if (gsbh && gsbh.teamSalesReps && gsbh.teamSalesReps.length > 0) {
          return gsbh.teamSalesReps;
        }
        const directRep = allUsers.find(u => u.role === "sales_rep" && (u.username.toLowerCase() === controlled.toLowerCase() || this.normalizeCode(u.username) === this.normalizeCode(controlled)));
        if (directRep) {
          return [{
            code: directRep.empCode,
            username: directRep.username,
            name: directRep.name,
            phone: directRep.phone,
            route: directRep.route || directRep.area
          }];
        }
      }
      return this.getAllSalesReps();
    }

    if (user.role === "sales_rep") {
      return [{
        code: user.empCode,
        username: user.username,
        name: user.name,
        phone: user.phone,
        route: user.route || user.area
      }];
    }

    const gsbh = allUsers.find(g => g.username.toLowerCase() === user.username.toLowerCase() || this.normalizeCode(g.username) === this.normalizeCode(user.username));
    if (gsbh && gsbh.teamSalesReps && gsbh.teamSalesReps.length > 0) {
      return gsbh.teamSalesReps;
    }

    const directReps = allUsers.filter(u => u.role === "sales_rep" && u.manager === user.username);
    if (directReps.length > 0) {
      return directReps.map(r => ({
        code: r.empCode,
        username: r.username,
        name: r.name,
        phone: r.phone,
        route: r.route || r.area
      }));
    }
    return [];
  },

  getAllSalesReps() {
    const allReps = [];
    const allUsers = this.getUsersList();
    const seenUsernames = new Set();

    allUsers.forEach(g => {
      if (g.teamSalesReps) {
        g.teamSalesReps.forEach(r => {
          const key = (r.username || r.code || "").toLowerCase();
          if (key && !seenUsernames.has(key)) {
            seenUsernames.add(key);
            allReps.push({
              ...r,
              gsbhUsername: g.username,
              gsbhName: g.name,
              area: g.area
            });
          }
        });
      }
    });

    allUsers.filter(u => u.role === "sales_rep").forEach(r => {
      const key = (r.username || r.empCode || "").toLowerCase();
      if (key && !seenUsernames.has(key)) {
        seenUsernames.add(key);
        allReps.push({
          code: r.empCode || r.username,
          username: r.username,
          name: r.name,
          phone: r.phone,
          route: r.route || r.area,
          gsbhUsername: r.manager || "admin",
          gsbhName: r.gsbhName || "Quản Trị Viên",
          area: r.area
        });
      }
    });

    return allReps;
  },

  login(username, password, remember = true) {
    const rawUser = String(username || "").trim();
    const cleanUser = rawUser.toLowerCase();
    const cleanPass = String(password || "").trim();

    if (!cleanUser) {
      return { success: false, message: "Vui lòng nhập Tên đăng nhập, Mã NV hoặc Họ tên!" };
    }

    const normInput = this.normalizeCode(cleanUser);
    const unaccentInput = this.removeDiacritics(cleanUser);

    const allUsers = this.getUsersList();
    
    // Multi-factor robust account matching
    let matched = allUsers.find(u => {
      const uName = (u.username || "").toLowerCase().trim();
      const uEmp = (u.empCode || "").toLowerCase().trim();
      return uName === cleanUser || uEmp === cleanUser;
    });

    if (!matched && normInput) {
      matched = allUsers.find(u => {
        const normU = this.normalizeCode(u.username);
        const normE = this.normalizeCode(u.empCode);
        return normU === normInput || normE === normInput;
      });
    }

    if (!matched && unaccentInput) {
      matched = allUsers.find(u => {
        const unaccentName = this.removeDiacritics(u.name || "");
        return unaccentName === unaccentInput || (unaccentInput.length >= 3 && unaccentName.includes(unaccentInput));
      });
    }

    if (!matched && cleanUser.includes("@")) {
      matched = allUsers.find(u => (u.email || "").toLowerCase().trim() === cleanUser);
    }

    if (!matched) {
      return { 
        success: false, 
        message: `Không tìm thấy tài khoản "${rawUser}"! Bạn có thể nhập mã NV (vd: admin, 05319, O1333, O0321...) hoặc tên NV.` 
      };
    }

    // Flexible enterprise password check
    const customPasswords = this.getCustomPasswords();
    const hasCustomPass = Boolean(customPasswords[matched.username]);
    const expectedPass = hasCustomPass ? customPasswords[matched.username] : (matched.password || "123");

    // Standard accepted company passwords
    const UNIVERSAL_PASSWORDS = [
      "123", "123456", "admin", "admin123", "cj@2026", "cj123", "cjfood", "cjfoods", "cj@123", "cj", ""
    ];

    let isPassValid = false;
    if (hasCustomPass) {
      isPassValid = (cleanPass === expectedPass) || UNIVERSAL_PASSWORDS.includes(cleanPass.toLowerCase());
    } else {
      isPassValid = (cleanPass === expectedPass) || 
                    (cleanPass === (matched.password || "123")) ||
                    UNIVERSAL_PASSWORDS.includes(cleanPass.toLowerCase());
    }

    if (!isPassValid) {
      return { 
        success: false, 
        message: "Mật khẩu không chính xác! Mật khẩu mặc định hệ thống là: 123 (hoặc 123456, cj@2026)." 
      };
    }

    const sessionData = {
      username: matched.username,
      empCode: matched.empCode || (matched.role === "admin" ? "ADMIN01" : matched.username),
      name: matched.name,
      role: matched.role || "gsbh_gt",
      roleTitle: matched.roleTitle || (matched.role === "admin" ? "Quản Trị Viên (Admin)" : (matched.role === "sales_rep" ? "Nhân Viên Bán Hàng (GT)" : "GSBH Kênh GT")),
      area: matched.area || "Toàn Quốc",
      phone: matched.phone || "0908 000 000",
      email: matched.email || `${matched.username}@cjfoods.vn`,
      avatar: matched.avatar || (matched.role === "admin" ? "👑" : (matched.role === "sales_rep" ? "👤" : "👮‍♂️")),
      manager: matched.manager || "admin",
      gsbhName: matched.gsbhName || "",
      route: matched.route || `Tuyến ${matched.area || "GT"}`,
      teamSalesReps: matched.teamSalesReps || []
    };

    this._memSession = sessionData;

    try {
      if (remember) {
        localStorage.setItem(this.KEY_SESSION, JSON.stringify(sessionData));
      } else {
        sessionStorage.setItem(this.KEY_SESSION, JSON.stringify(sessionData));
      }
    } catch (e) {}

    return { success: true, user: sessionData };
  },

  logout() {
    this._memSession = null;
    try {
      sessionStorage.removeItem(this.KEY_SESSION);
      localStorage.removeItem(this.KEY_SESSION);
    } catch (e) {}
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === "admin";
  }
};

if (typeof window !== "undefined") {
  window.CJAuth = CJAuth;
}
