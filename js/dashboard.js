/**
 * CJ MarketAudit - Dashboard & Map Analytics
 * Strictly filtered by the logged-in GSBH's customer territory
 */

const CJDashboard = {
  map: null,
  mapMarkers: [],
  charts: {},

  init() {
    this.populateSalesFilterDropdown();
    this.initMap();
    this.refresh();
    this.bindEvents();
  },

  refresh() {
    this.renderAuditCategories();
    this.renderAuditTable();
    this.renderTicketsTable();
    this.renderStoreManagementTable();
  },

  bindEvents() {
    const channelFilter = document.getElementById("dashChannelFilter");
    if (channelFilter) {
      channelFilter.addEventListener("change", () => this.applyFilters());
    }

    const statusFilter = document.getElementById("dashStatusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => this.applyFilters());
    }

    const salesFilter = document.getElementById("dashSalesFilter");
    if (salesFilter) {
      salesFilter.addEventListener("change", () => {
        this.renderAuditCategories();
        this.applyFilters();
      });
    }

    const searchAudit = document.getElementById("dashAuditSearch");
    if (searchAudit) {
      searchAudit.addEventListener("input", (e) => this.filterAuditTable(e.target.value));
    }
  },

  populateSalesFilterDropdown() {
    const filterEl = document.getElementById("dashSalesFilter");
    const mobileFilterEl = document.getElementById("dashMobileSalesFilter");
    const teamReps = CJAuth.getCurrentTeamSalesReps();
    const optionsHtml = `<option value="ALL">📋 Tất cả NVBH Kênh GT (${teamReps.length} NV)</option>` +
      teamReps.map(s => `<option value="${s.username}">👤 ${s.name} (${s.code} - ${s.route})</option>`).join("");

    if (filterEl) filterEl.innerHTML = optionsHtml;
    if (mobileFilterEl) mobileFilterEl.innerHTML = optionsHtml;
  },

  onMobileSalesFilterChange(val) {
    const desktopFilter = document.getElementById("dashSalesFilter");
    if (desktopFilter) desktopFilter.value = val;
    this.renderAuditCategories();
    this.applyFilters();
  },

  /**
   * Render overview of all Audit Categories strictly requested by user:
   * "màn hình dashboard chỉ hiển thị tổng quan về loại kiểm tra (ví dụ: kiểm tra tình trạng tủ đông,...)
   * và có tổng hợp từng loại tổng bao nhiêu cần kiểm tra, hoàn thành bao nhiêu,... các chỉ số cần thiết,
   * khi muốn kiểm tra thì bấm vào nội dung sẽ hiện ra màn hình danh sách KH kiểm tra"
   */
  renderAuditCategories() {
    const container = document.getElementById("dashAuditCategoriesContainer");
    if (!container) return;

    const selectedSales = document.getElementById("dashSalesFilter")?.value || 
                          document.getElementById("dashMobileSalesFilter")?.value || "ALL";
    const stores = CJStorage.getStoresForCurrentGSBH(selectedSales).filter(s => !s.channel || s.channel === "GT");
    const totalStores = stores.length;

    // Lấy số lượng tủ đông thực tế (bao gồm cả các điểm bán có nhiều tủ)
    const freezers = (typeof CJStorage !== "undefined" && CJStorage.getFreezersForCurrentGSBH) 
      ? CJStorage.getFreezersForCurrentGSBH(selectedSales) 
      : [];
    const totalFreezers = freezers.length > 0 ? freezers.length : totalStores;
    const freezerLabel = totalFreezers > totalStores ? ` (${totalFreezers} Tủ)` : "";
    const freezerFullLabel = totalFreezers > totalStores ? ` (${totalFreezers} Tủ đông)` : "";

    const audits = CJStorage.getAuditsForCurrentGSBH();
    const auditedStoreIds = new Set(audits.map(a => a.storeId));
    const auditedStoresCount = stores.filter(s => auditedStoreIds.has(s.id)).length;
    const dangerStoresCount = stores.filter(s => s.status === "danger").length;
    const goodStoresCount = stores.filter(s => s.status === "good").length;
    const tickets = CJStorage.getTickets();
    const recallTickets = tickets.filter(t => t.type === "RECALL_POSM");

    const overallRate = totalStores > 0 ? Math.round((auditedStoresCount / totalStores) * 100) : 0;

    // Update Overall Completion Card (Phía trên theo yêu cầu người dùng)
    this.setElText("dashOverallCompletionPercent", `${overallRate}%`);
    this.setElText("dashOverallCompletedTasks", `${auditedStoresCount} / ${totalStores} Khách hàng${freezerFullLabel}`);
    this.setElText("dashOverallTotalTasks", `${totalStores} Điểm${freezerLabel}`);
    const overallBar = document.getElementById("dashOverallProgressBar");
    if (overallBar) {
      overallBar.style.width = `${overallRate}%`;
    }

    // Update Top Summary Bar (Desktop Mode)
    this.setElText("dashSummaryProgramsCount", "Kiểm Tra Tủ Đông");
    this.setElText("dashSummaryTotalStores", `${totalStores} Khách hàng${freezerFullLabel}`);
    this.setElText("dashSummaryCompletedTotal", `${auditedStoresCount} Điểm (${overallRate}%)`);
    this.setElText("dashSummaryDangerTotal", `${dangerStoresCount} Điểm (${dangerStoresCount > 0 ? 'Cần xử lý' : 'An toàn'})`);
    const subAssigned = document.getElementById("dashSummaryAssignedSub");
    if (subAssigned) {
      const areaText = selectedSales === "ALL" ? "Toàn bộ khu vực GSBH" : `NVBH: ${selectedSales}`;
      subAssigned.textContent = `${areaText} • ${totalFreezers} Tủ đông`;
    }

    // Update Quick KPI Summary (Mobile Mode)
    this.setElText("dashMobileSummaryPrograms", "Kiểm tra tủ đông");
    this.setElText("dashMobileSummaryStores", `${totalStores} KH${freezerLabel}`);
    this.setElText("dashMobileSummaryCompleted", `${auditedStoresCount} Điểm (${overallRate}%)`);
    this.setElText("dashMobileSummaryDanger", `${dangerStoresCount} Điểm (${dangerStoresCount > 0 ? 'Cần xử lý' : 'An toàn'})`);

    // Focus exclusively on Freezer Inspection (Kiểm tra tủ đông) as requested by user
    const categories = [
      {
        key: "posm_health",
        icon: "❄️",
        name: "Kiểm Tra Tình Trạng Tủ Đông POSM (Kênh GT)",
        tag: "TRỌNG TÂM • HÀNG NGÀY",
        tagColor: "bg-red-100 text-cj-red border-red-200",
        description: "Kiểm tra tủ còn cắm điện hoạt động không, nhiệt độ đông sâu đạt chuẩn (-18°C), quét mã QR/Barcode tem tủ POSM và phát hiện kịp thời hư hỏng, xì gas, vỡ kính, hỏng đệm gioăng.",
        targetCount: totalStores,
        doneCount: auditedStoresCount,
        pendingCount: Math.max(0, totalStores - auditedStoresCount),
        rate: overallRate,
        barColor: "bg-red-600",
        stats: [
          { label: "Tổng cần kiểm tra", value: `${totalStores} KH${freezerLabel}`, color: "text-gray-900 bg-gray-50 border-gray-200 font-bold" },
          { label: "Đã hoàn thành", value: `${auditedStoresCount} KH`, color: "text-emerald-800 bg-emerald-50 border-emerald-200 font-bold" },
          { label: "Chưa kiểm tra", value: `${Math.max(0, totalStores - auditedStoresCount)} KH`, color: "text-amber-800 bg-amber-50 border-amber-200 font-bold" },
          { label: "Tủ đạt chuẩn tốt", value: `${goodStoresCount} tủ tốt`, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "Có sự cố / Tắt điện", value: `${dangerStoresCount} sự cố`, color: "text-red-700 bg-red-50 border-red-200 font-black" }
        ],
        badgeDetail: "Chụp ảnh & ghi chú bắt buộc khi hư hỏng/tắt điện/mất mã QR",
        actionText: `🛵 Bấm Vào Để Mở Danh Sách Khách Hàng Kiểm Tra Tủ Đông (${totalStores} KH - ${totalFreezers} Tủ) ➔`
      }
    ];

    container.innerHTML = categories.map(cat => {
      return `
        <div 
          onclick="CJDashboard.startAuditCategory('${cat.key}')" 
          class="bg-white rounded-3xl border-2 border-gray-200 hover:border-blue-500 shadow-sm hover:shadow-lg p-4 sm:p-5 transition cursor-pointer group active:scale-[0.99] space-y-3.5"
          title="Bấm vào để mở danh sách khách hàng và tiến hành ${cat.name}">
          
          <!-- Top Row: Icon + Name + Tag Badge -->
          <div class="flex items-start justify-between gap-2.5">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-2xl bg-gray-50 group-hover:bg-blue-50 border border-gray-200 group-hover:border-blue-300 text-2xl flex items-center justify-center shrink-0 transition">
                ${cat.icon}
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-1.5 mb-1">
                  <span class="text-[10px] font-black px-2 py-0.5 rounded-full border ${cat.tagColor}">
                    ${cat.tag}
                  </span>
                  <span class="text-[10px] text-gray-500 font-medium">
                    ${cat.badgeDetail}
                  </span>
                </div>
                <h3 class="font-black text-base sm:text-lg text-gray-900 group-hover:text-blue-900 transition leading-tight">
                  ${cat.name}
                </h3>
              </div>
            </div>

            <!-- Progress % Capsule -->
            <div class="text-right shrink-0">
              <div class="text-xl sm:text-2xl font-black text-gray-900">${cat.rate}%</div>
              <div class="text-[10px] text-gray-400 font-bold">Hoàn thành</div>
            </div>
          </div>

          <!-- Description -->
          <p class="text-xs text-gray-600 leading-relaxed">
            ${cat.description}
          </p>

          <!-- Progress Bar -->
          <div class="space-y-1">
            <div class="flex justify-between text-[11px] font-bold text-gray-600">
              <span>Tiến độ thực hiện ca:</span>
              <span class="text-gray-900 font-black">${cat.doneCount} / ${cat.targetCount} hoàn thành</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
              <div class="${cat.barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${cat.rate}%"></div>
            </div>
          </div>

          <!-- Key Metrics Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 text-xs">
            ${cat.stats.map(s => `
              <div class="p-2 rounded-xl border ${s.color} flex flex-col justify-between">
                <span class="text-[10px] text-gray-500 font-medium">${s.label}</span>
                <span class="font-extrabold text-xs mt-0.5">${s.value}</span>
              </div>
            `).join("")}
          </div>

          <!-- Action CTA Button Strip -->
          <div class="pt-1">
            <button 
              type="button" 
              onclick="event.stopPropagation(); CJDashboard.startAuditCategory('${cat.key}')" 
              class="w-full bg-[#184594] group-hover:bg-blue-700 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow transition flex items-center justify-center gap-2 active:scale-98">
              <span>${cat.actionText}</span>
            </button>
          </div>

        </div>
      `;
    }).join("");
  },

  /**
   * Action when clicking any category:
   * Navigate to Screen 2 (Customer List), apply context, and prompt user
   */
  startAuditCategory(categoryKey) {
    const categoryInfo = {
      posm_health: {
        title: "Kiểm Tra Tủ Đông POSM",
        icon: "❄️",
        guide: "Kiểm tra trạng thái nguồn điện, nhiệt độ đông sâu (-18°C), tem mã QR/Barcode và phát hiện kịp thời hư hỏng thiết bị."
      }
    };

    const cat = categoryInfo[categoryKey] || categoryInfo.posm_health;

    // Switch to Customer List tab (Screen 2)
    CJApp.switchTab("mobileAudit");

    // Ensure we are in list view mode
    if (typeof CJAudit !== "undefined") {
      if (CJAudit.switchViewMode) {
        CJAudit.switchViewMode("list");
      }
      if (CJAudit.renderStoreList) {
        CJAudit.renderStoreList();
      }
    }

    // Display active category banner in Customer List
    const banner = document.getElementById("activeAuditCategoryBanner");
    const iconEl = document.getElementById("activeCategoryIcon");
    const titleEl = document.getElementById("activeCategoryTitle");
    const guideEl = document.getElementById("activeCategoryGuide");

    if (banner) banner.classList.remove("hidden");
    if (iconEl) iconEl.textContent = cat.icon;
    if (titleEl) titleEl.textContent = `🎯 Đang kiểm tra: ${cat.title}`;
    if (guideEl) guideEl.textContent = cat.guide;

    if (typeof CJAudit !== "undefined" && CJAudit.showToast) {
      CJAudit.showToast(`🛵 MÀN HÌNH 2: Danh sách khách hàng cần kiểm tra tủ đông!`, "info");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  initMap() {
    const mapContainer = document.getElementById("marketMap");
    if (!mapContainer) return;

    try {
      if (this.map) {
        this.map.remove();
      }

      this.map = L.map("marketMap").setView([10.795, 106.69], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap | CJ Foods Vietnam'
      }).addTo(this.map);

      this.updateMapMarkers();
    } catch (e) {
      console.warn("Leaflet map init warning:", e);
    }
  },

  updateMapMarkers() {
    if (!this.map || typeof L === "undefined") return;

    this.mapMarkers.forEach(m => m.remove());
    this.mapMarkers = [];

    const stores = CJStorage.getStoresForCurrentGSBH();
    const bounds = [];

    stores.forEach(store => {
      if (!store.lat || !store.lng) return;

      const freezer = CJStorage.getFreezerById(store.freezerId);
      const isGood = store.status === "good";
      const isWarning = store.status === "warning";
      const markerColor = isGood ? "#10B981" : (isWarning ? "#F59E0B" : "#EF4444");

      const customIcon = L.divIcon({
        className: "custom-map-marker",
        html: `
          <div style="
            background-color: ${markerColor};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: bold;
          ">
            ${store.channel}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([store.lat, store.lng], { icon: customIcon }).addTo(this.map);

      const statusBadge = isGood ? '<span class="text-emerald-600 font-bold">● Đạt chuẩn</span>' :
        isWarning ? '<span class="text-amber-600 font-bold">▲ Cảnh báo</span>' :
        '<span class="text-red-600 font-bold">■ Nguy cơ hư hỏng!</span>';

      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;

      const popupHtml = `
        <div class="text-xs p-1 space-y-1">
          <div class="font-bold text-sm text-gray-900">${store.name}</div>
          <div class="text-gray-500">${store.id} • 👤 NVBH: <b>${store.salesRep}</b></div>
          <div>Tình trạng: ${statusBadge}</div>
          <div class="text-gray-700">📍 ${store.address}</div>
          <div class="bg-gray-50 p-1.5 rounded border mt-1">
            <div><b>Mã Tủ:</b> ${freezer ? freezer.assetTag : 'N/A'}</div>
            <div><b>Nhiệt độ:</b> ${freezer ? freezer.lastTemperature + '°C' : '-19°C'}</div>
          </div>
          <div class="grid grid-cols-2 gap-1 pt-1">
            <a href="${gmapsUrl}" target="_blank" class="bg-blue-600 text-white font-bold py-1 px-2 rounded text-center text-[10px]">
              📍 Chỉ Đường
            </a>
            <button onclick="CJAudit.selectStore('${store.id}'); CJApp.switchTab('mobileAudit');" class="bg-cj-red text-white font-bold py-1 px-2 rounded text-[10px]">
              🔍 Kiểm Tra
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.mapMarkers.push(marker);
      bounds.push([store.lat, store.lng]);
    });

    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [35, 35] });
    }
  },

  renderCharts() {
    if (typeof Chart === "undefined") return;

    const stores = CJStorage.getStoresForCurrentGSBH();
    const storeIds = new Set(stores.map(s => s.id));
    const freezers = CJStorage.getFreezers().filter(f => storeIds.has(f.assignedStoreId));
    const audits = CJStorage.getAuditsForCurrentGSBH();

    let good = 0, warning = 0, danger = 0;
    freezers.forEach(f => {
      if (f.status === "good") good++;
      else if (f.status === "warning") warning++;
      else danger++;
    });

    const ctxStatus = document.getElementById("chartFreezerStatus");
    if (ctxStatus) {
      if (this.charts.status) this.charts.status.destroy();
      this.charts.status = new Chart(ctxStatus, {
        type: "doughnut",
        data: {
          labels: ["Đạt chuẩn (-18°C)", "Cảnh báo nhiệt độ", "Nguy cơ hư hỏng"],
          datasets: [{
            data: [good || 1, warning, danger],
            backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
            borderWidth: 2,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
          cutout: "65%"
        }
      });
    }

    const channelTemps = { GT: [], MT: [], B2B: [] };
    audits.forEach(a => {
      if (channelTemps[a.channel]) {
        channelTemps[a.channel].push(a.temperature);
      }
    });

    const avgGT = channelTemps.GT.length ? (channelTemps.GT.reduce((a, b) => a + b, 0) / channelTemps.GT.length).toFixed(1) : -19;
    const avgMT = channelTemps.MT.length ? (channelTemps.MT.reduce((a, b) => a + b, 0) / channelTemps.MT.length).toFixed(1) : -20;
    const avgB2B = channelTemps.B2B.length ? (channelTemps.B2B.reduce((a, b) => a + b, 0) / channelTemps.B2B.length).toFixed(1) : -18;

    const ctxTemp = document.getElementById("chartChannelTemp");
    if (ctxTemp) {
      if (this.charts.temp) this.charts.temp.destroy();
      this.charts.temp = new Chart(ctxTemp, {
        type: "bar",
        data: {
          labels: ["GT (Tạp hóa)", "MT (Siêu thị)", "B2B (Horeca)"],
          datasets: [{
            label: "Nhiệt độ TB (°C)",
            data: [avgGT, avgMT, avgB2B],
            backgroundColor: ["#3B82F6", "#8B5CF6", "#10B981"],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false,
              suggestedMin: -25,
              suggestedMax: 0,
              title: { display: true, text: "Nhiệt độ (°C)", font: { size: 11 } }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  },

  renderAuditTable(filteredAudits = null) {
    const tbody = document.getElementById("dashAuditTableBody");
    if (!tbody) return;

    const audits = filteredAudits || CJStorage.getAuditsForCurrentGSBH();

    if (audits.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-500">Chưa có dữ liệu kiểm tra phù hợp trong khu vực của bạn.</td></tr>`;
      return;
    }

    tbody.innerHTML = audits.map(audit => {
      const tempBadge = audit.tempStatus === "pass" ?
        `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">${audit.temperature}°C</span>` :
        audit.tempStatus === "warning" ?
        `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">${audit.temperature}°C</span>` :
        `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 animate-pulse">${audit.temperature}°C</span>`;

      const ratingBadge = audit.rating === "A" ?
        `<span class="font-bold text-emerald-600">A (${audit.score}đ)</span>` :
        audit.rating === "B" ?
        `<span class="font-bold text-amber-600">B (${audit.score}đ)</span>` :
        `<span class="font-bold text-red-600">C (${audit.score}đ)</span>`;

      const powerBadge = audit.isPowered ?
        `<span class="text-emerald-600 font-bold" title="Đang cắm điện">⚡ Cắm</span>` :
        `<span class="text-red-600 font-bold bg-red-50 px-1 rounded" title="Tắt nguồn">⚠️ Rút</span>`;

      const ticketBadge = audit.ticketCreated ?
        `<span class="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-bold">Có Ticket</span>` :
        `<span class="text-gray-400 text-xs">-</span>`;

      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
          <td class="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">
            <div>${audit.id}</div>
            <div class="text-[11px] text-gray-400 font-normal">${audit.auditTime}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-bold text-gray-900">${audit.storeName}</div>
            <div class="text-[11px] text-gray-500">${audit.storeId} • 👤 ${audit.auditorName}</div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">${audit.channel}</span>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="font-medium text-gray-800">${audit.assetTag}</div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              ${powerBadge}
              ${tempBadge}
            </div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="font-bold text-gray-800">${audit.sosCJ}%</div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            ${ratingBadge}
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            ${ticketBadge}
          </td>
          <td class="py-3 px-3 text-right whitespace-nowrap">
            <button onclick="CJDashboard.viewAuditDetails('${audit.id}')" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-semibold text-[11px] transition">
              Xem Chi Tiết
            </button>
          </td>
        </tr>
      `;
    }).join("");
  },

  viewAuditDetails(auditId) {
    const audit = CJStorage.getAuditById(auditId);
    if (!audit) return;

    const modal = document.getElementById("dashAuditDetailModal");
    if (!modal) return;

    document.getElementById("modalDetailTitle").textContent = `Chi tiết kiểm tra: ${audit.storeName} (${audit.id})`;
    document.getElementById("detailStoreCode").textContent = `${audit.storeId} | Kênh: ${audit.channel}`;
    document.getElementById("detailAuditTime").textContent = audit.auditTime;
    document.getElementById("detailAuditor").textContent = audit.auditorName;
    document.getElementById("detailAssetTag").textContent = audit.assetTag;
    document.getElementById("detailTemp").textContent = `${audit.temperature}°C (Nguồn: ${audit.isPowered ? 'Đang cắm điện' : 'Rút điện'})`;
    document.getElementById("detailSos").textContent = `${audit.sosCJ}% - Đối thủ: ${audit.competitorsFound?.length ? audit.competitorsFound.join(", ") : "Không có"}`;
    document.getElementById("detailScore").textContent = `${audit.score}/100 - Xếp loại ${audit.rating}`;
    document.getElementById("detailNotes").textContent = audit.issuesNotes || "Không có ghi chú thêm.";

    const photoContainer = document.getElementById("detailPhotoContainer");
    if (photoContainer) {
      photoContainer.innerHTML = "";
      const photos = audit.photos || {};
      const labels = {
        posm: "1. Hình ảnh Tủ đông POSM",
        overview: "2. Hình Tổng quan Cửa hàng",
        inside: "Bên trong tủ & Hàng hóa",
        tag: "Tem tài sản / Barcode",
        recall: "Biên bản thu hồi POSM"
      };

      let photoCount = 0;
      Object.keys(labels).forEach(key => {
        if (photos[key]) {
          photoCount++;
          const col = document.createElement("div");
          col.className = "space-y-1";
          col.innerHTML = `
            <div class="text-xs font-semibold text-gray-700">${labels[key]}</div>
            <div class="relative group rounded-xl overflow-hidden border border-gray-300 bg-gray-900 cursor-pointer" onclick="CJDashboard.openLightbox('${photos[key]}')">
              <img src="${photos[key]}" class="w-full h-44 object-cover group-hover:scale-105 transition-transform" />
              <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">
                🔍 Phóng to ảnh Watermark
              </div>
            </div>
          `;
          photoContainer.appendChild(col);
        }
      });

      if (photoCount === 0) {
        photoContainer.innerHTML = `<div class="col-span-3 text-center py-6 text-gray-400 text-xs italic">Lượt kiểm tra này chưa đính kèm ảnh chụp thực địa.</div>`;
      }
    }

    modal.classList.remove("hidden");
  },

  closeAuditDetailModal() {
    const modal = document.getElementById("dashAuditDetailModal");
    if (modal) modal.classList.add("hidden");
  },

  openLightbox(imgSrc) {
    const lbModal = document.getElementById("photoViewModal");
    const lbImg = document.getElementById("modalPhotoImg");
    if (lbModal && lbImg) {
      lbImg.src = imgSrc;
      lbModal.classList.remove("hidden");
    }
  },

  renderTicketsTable() {
    const tbody = document.getElementById("dashTicketsTableBody");
    if (!tbody) return;

    const tickets = CJStorage.getTickets();
    if (tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">Hiện không có ticket sự cố nào trong danh sách điểm bán của bạn.</td></tr>`;
      return;
    }

    tbody.innerHTML = tickets.map(t => {
      const priorityBadge = t.priority === "CRITICAL" ?
        `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white animate-pulse">KHẨN CẤP</span>` :
        `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white">TRUNG BÌNH</span>`;

      const statusBadge = t.status === "OPEN" ?
        `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">Chờ xử lý</span>` :
        t.status === "IN_PROGRESS" ?
        `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">Đang xử lý</span>` :
        `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Đã hoàn thành</span>`;

      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
          <td class="py-3 px-3 font-semibold text-gray-900">${t.ticketId}</td>
          <td class="py-3 px-3">
            <div class="font-bold text-gray-900">${t.storeName}</div>
            <div class="text-gray-500">${t.storeId} • Tủ: ${t.assetTag}</div>
          </td>
          <td class="py-3 px-3 text-red-600 font-semibold">${t.issueType}</td>
          <td class="py-3 px-3">${priorityBadge}</td>
          <td class="py-3 px-3">${statusBadge}</td>
          <td class="py-3 px-3 text-gray-500">${t.createdAt}</td>
          <td class="py-3 px-3 text-right">
            <select onchange="CJDashboard.changeTicketStatus('${t.ticketId}', this.value)" class="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
              <option value="OPEN" ${t.status === 'OPEN' ? 'selected' : ''}>Chờ xử lý</option>
              <option value="IN_PROGRESS" ${t.status === 'IN_PROGRESS' ? 'selected' : ''}>Đang xử lý</option>
              <option value="RESOLVED" ${t.status === 'RESOLVED' ? 'selected' : ''}>Đã xong</option>
            </select>
          </td>
        </tr>
      `;
    }).join("");
  },

  changeTicketStatus(ticketId, newStatus) {
    CJStorage.updateTicketStatus(ticketId, newStatus);
    this.refresh();
    CJAudit.showToast(`Đã cập nhật ticket ${ticketId}`, "success");
  },

  renderStoreManagementTable() {
    const tbody = document.getElementById("dashStoreTableBody");
    if (!tbody) return;

    const stores = CJStorage.getStoresForCurrentGSBH();

    tbody.innerHTML = stores.map(s => {
      const freezer = CJStorage.getFreezerById(s.freezerId);
      const serialDisplay = s.serialNumber || s.barcode || (freezer ? (freezer.serialNumber || freezer.barcode || freezer.assetTag) : '') || s.freezerId || 'Chưa gắn';
      const modelDisplay = s.modelTu || s.freezerModel || s.model || (freezer ? freezer.model : '');
      const phoneDisplay = (s.phone && s.phone.trim() !== '' && s.phone !== '0903000000' && s.phone !== '0903 000 000') ? `<div class="text-[10px] text-blue-900 font-bold">📞 ${s.phone}</div>` : '';
      const repDisplay = s.salesRep || s.gsbhName || 'Chưa phân công';
      const statusBadge = s.status === "good" ? `<span class="text-emerald-600 font-bold">● Tốt</span>` :
        s.status === "warning" ? `<span class="text-amber-600 font-bold">▲ Cảnh báo</span>` :
        `<span class="text-red-600 font-bold">■ Nguy cơ</span>`;

      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
          <td class="py-3 px-3 font-semibold text-gray-900">${s.id}</td>
          <td class="py-3 px-3">
            <div class="font-bold text-gray-900">${s.name}</div>
            <div class="text-[10px] text-gray-400">${s.route || ''}</div>
            ${phoneDisplay}
          </td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">${s.channel}</span></td>
          <td class="py-3 px-3 text-gray-600">${s.address}</td>
          <td class="py-3 px-3 font-bold text-blue-900">${repDisplay} (${s.salesRepCode || s.assignedUser || 'NV'})</td>
          <td class="py-3 px-3 font-medium text-gray-800">
            <div class="font-bold text-blue-950">${serialDisplay}</div>
            ${modelDisplay ? `<div class="text-[10px] text-gray-500">${modelDisplay}</div>` : ''}
          </td>
          <td class="py-3 px-3">${statusBadge}</td>
          <td class="py-3 px-3 text-right">
            <button onclick="CJAudit.selectStore('${s.id}'); CJApp.switchTab('mobileAudit');" class="text-cj-red font-semibold hover:underline">Kiểm tra ngay</button>
          </td>
        </tr>
      `;
    }).join("");
  },

  applyFilters() {
    let audits = CJStorage.getAuditsForCurrentGSBH();

    const channel = document.getElementById("dashChannelFilter")?.value || "ALL";
    const status = document.getElementById("dashStatusFilter")?.value || "ALL";
    const salesUser = document.getElementById("dashSalesFilter")?.value || "ALL";

    audits = audits.filter(a => {
      const matchChannel = channel === "ALL" || a.channel === channel;
      const matchStatus = status === "ALL" ||
        (status === "good" && a.tempStatus === "pass" && a.score >= 80) ||
        (status === "warning" && a.tempStatus === "warning") ||
        (status === "danger" && (a.tempStatus === "danger" || !a.isPowered));
      const matchSales = salesUser === "ALL" || (a.assignedUser && a.assignedUser === salesUser);
      return matchChannel && matchStatus && matchSales;
    });

    this.renderAuditTable(audits);
  },

  filterAuditTable(query) {
    const q = (query || "").toLowerCase().trim();
    if (!q) {
      this.applyFilters();
      return;
    }
    const audits = CJStorage.getAuditsForCurrentGSBH().filter(a =>
      a.storeName.toLowerCase().includes(q) ||
      a.storeId.toLowerCase().includes(q) ||
      a.assetTag.toLowerCase().includes(q) ||
      a.auditorName.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
    this.renderAuditTable(audits);
  }
};
