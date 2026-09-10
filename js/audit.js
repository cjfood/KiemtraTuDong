/**
 * CJ MarketAudit - GSBH Field Audit Controller
 * Turn-by-turn Google Maps navigation, strict customer isolation by GSBH
 */

const CJAudit = {
  currentStore: null,
  currentFreezer: null,
  currentPhotos: {
    overview: null,
    inside: null,
    tag: null
  },
  currentGPS: { lat: 10.801522, lng: 106.708215 },
  selectedSalesRep: "ALL",

  init() {
    this.requestGPS();
    this.bindEvents();
    this.populateSalesRepFilter();
    this.renderStoreList();
  },

  requestGPS() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentGPS = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          const gpsEl = document.getElementById("mobileGpsIndicator");
          if (gpsEl) {
            gpsEl.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span> GPS Vị Trí: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
          }
        },
        () => {
          const gpsEl = document.getElementById("mobileGpsIndicator");
          if (gpsEl) {
            gpsEl.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span> GPS: 10.8015, 106.7082 (TP.HCM)`;
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  },

  /**
   * Populates the Sales Rep filter dropdown ONLY with NVBH under the logged-in GSBH!
   */
  populateSalesRepFilter() {
    const filterEl = document.getElementById("filterSalesRepSelect");
    if (!filterEl) return;

    const teamReps = CJAuth.getCurrentTeamSalesReps();
    const countLabel = teamReps.length > 0 ? ` (${teamReps.length} NV)` : "";
    let optionsHtml = `<option value="ALL">📋 Tất cả NVBH${countLabel}</option>`;

    if (teamReps.length > 0) {
      optionsHtml += teamReps.map(rep => {
        const shortName = rep.name ? rep.name.split(' ').pop() : rep.username;
        return `<option value="${rep.username}">👤 ${shortName} (${rep.empCode || rep.username})</option>`;
      }).join("");
    }

    filterEl.innerHTML = optionsHtml;

    // Check if previously selected rep is still valid in current team
    if (this.selectedSalesRep && this.selectedSalesRep !== "ALL") {
      const isValid = teamReps.some(r => r.username === this.selectedSalesRep);
      if (!isValid) {
        this.selectedSalesRep = "ALL";
      }
    } else {
      this.selectedSalesRep = "ALL";
    }

    filterEl.value = this.selectedSalesRep;

    filterEl.onchange = (e) => {
      this.selectedSalesRep = e.target.value;
      this.renderStoreList();
    };
  },

  bindEvents() {
    const searchInput = document.getElementById("storeSearchInput");
    const clearBtn = document.getElementById("btnClearSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterStores(e.target.value);
        if (clearBtn) {
          if (e.target.value.trim().length > 0) {
            clearBtn.classList.remove("hidden");
          } else {
            clearBtn.classList.add("hidden");
          }
        }
      });
    }

    const channelFilters = document.querySelectorAll(".channel-filter-btn");
    channelFilters.forEach(btn => {
      btn.addEventListener("click", () => {
        channelFilters.forEach(b => {
          b.classList.remove("bg-cj-red", "text-white");
          b.classList.add("bg-gray-100", "text-gray-700");
        });
        btn.classList.remove("bg-gray-100", "text-gray-700");
        btn.classList.add("bg-cj-red", "text-white");
        this.filterStoresByChannel(btn.dataset.channel);
      });
    });

    // Tình trạng POSM dropdown
    const conditionSelect = document.getElementById("auditPosmCondition");
    if (conditionSelect) {
      conditionSelect.addEventListener("change", () => this.onConditionChange());
    }

    // Ghi chú - xóa viền đỏ khi người dùng bắt đầu gõ
    const notesInput = document.getElementById("auditNotes");
    if (notesInput) {
      notesInput.addEventListener("input", () => {
        if (notesInput.value.trim().length > 0) {
          notesInput.classList.remove("border-red-500", "ring-2", "ring-red-300");
          const errEl = document.getElementById("notesErrorMsg");
          if (errEl) errEl.classList.add("hidden");
        }
      });
    }

    // Photo input for POSM
    ["posm", "overview", "tag"].forEach(photoType => {
      const input = document.getElementById(`photo_input_${photoType}`);
      if (input) {
        input.addEventListener("change", (e) => this.handlePhotoUpload(e, photoType));
      }
    });

    // Mock photo button for POSM
    ["posm", "overview", "tag"].forEach(photoType => {
      const btn = document.getElementById(`btn_mock_${photoType}`);
      if (btn) {
        btn.addEventListener("click", () => this.generateMockPhoto(photoType));
      }
    });

    const auditForm = document.getElementById("mobileAuditForm");
    if (auditForm) {
      auditForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitAudit();
      });
    }

    // Cập nhật đồng hồ status bar điện thoại theo giờ hiện tại
    const updateClocks = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const clockEl = document.getElementById("mobileStatusBarClock");
      const listClockEl = document.getElementById("customerListClock");
      if (clockEl) clockEl.textContent = `${hh}:${mm}`;
      if (listClockEl) listClockEl.textContent = `${hh}:${mm}`;
    };
    updateClocks();
    setInterval(updateClocks, 30000);
  },

  /**
   * Giám sát tình trạng POSM:
   * Quy định chụp ảnh theo từng trường hợp Kênh GT:
   * 1. Hư hỏng -> BẮT BUỘC 100% (Ảnh cận cảnh vết hỏng + ghi chú)
   * 2. Không hoạt động -> BẮT BUỘC 100% (Ảnh phích cắm/công tắc tắt + ghi chú)
   * 3. Mất tem / Rách mã QR -> BẮT BUỘC 100% (Ảnh góc tem rách + ghi chú)
   * 4. Lý do khác -> BẮT BUỘC 100% (Ảnh toàn cảnh hiện trường + ghi chú)
   * 5. Sử Dụng Được -> KHUYẾN KHÍCH (Chụp hàng trưng bày Planogram)
   */
  onConditionChange() {
    const conditionSelect = document.getElementById("auditPosmCondition");
    const condition = conditionSelect ? conditionSelect.value : "Sử Dụng Được";
    const isAbnormal = condition && condition !== "Sử Dụng Được";

    const alertBox = document.getElementById("auditAbnormalAlertBox");
    const photoBadge = document.getElementById("photoRequiredBadge");
    const notesBadge = document.getElementById("notesRequiredBadge");
    const photoContainer = document.getElementById("photoEvidenceContainer");
    const guideIcon = document.getElementById("photoGuideIcon");
    const guideText = document.getElementById("photoGuideText");
    const alertTitle = document.getElementById("auditAbnormalAlertTitle");
    const alertDesc = document.getElementById("auditAbnormalAlertDesc");

    if (condition === "Hư hỏng") {
      if (photoBadge) {
        photoBadge.innerHTML = "🔴 BẮT BUỘC CHỤP ẢNH HƯ HỎNG";
        photoBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300 animate-pulse";
      }
      if (guideIcon) guideIcon.textContent = "🛠️";
      if (guideText) guideText.innerHTML = "<b>Góc chụp bắt buộc (Hư hỏng):</b> Chụp cận cảnh chi tiết hỏng (máy nén/lốc kêu to, xì gas, dàn bám tuyết dày, nứt kính, hỏng gioăng...) để gửi Ticket kỹ thuật bảo hành cho NPP & CJ.";
      if (alertTitle) alertTitle.textContent = "⚠️ BẮT BUỘC ẢNH & GHI CHÚ KHI HƯ HỎNG:";
      if (alertDesc) alertDesc.innerHTML = "Thiết bị hư hỏng bắt buộc phải chụp <b>1 ảnh cận cảnh vị trí hỏng</b> có GPS Watermark và nhập <b>Ghi chú chi tiết</b> hiện tượng kỹ thuật trước khi Lưu!";
      if (photoContainer) photoContainer.className = "p-3.5 rounded-2xl border-2 border-red-500 bg-red-50/30 space-y-2.5 transition";
      if (alertBox) alertBox.classList.remove("hidden");
      if (notesBadge) notesBadge.classList.remove("hidden");
    } else if (condition === "Mất (ko có tại cửa hàng)" || condition === "Không hoạt động") {
      if (photoBadge) {
        photoBadge.innerHTML = "🔴 BẮT BUỘC CHỤP MẶT BẰNG MẤT TỦ";
        photoBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300 animate-pulse";
      }
      if (guideIcon) guideIcon.textContent = "🏢";
      if (guideText) guideText.innerHTML = "<b>Góc chụp bắt buộc (Mất tủ):</b> Chụp hiện trường vị trí trước đây đặt tủ hoặc toàn cảnh mặt tiền cửa hàng để lập biên bản xác nhận mất tủ tài sản CJ.";
      if (alertTitle) alertTitle.textContent = "⚠️ BẮT BUỘC ẢNH & GHI CHÚ KHI MẤT TỦ:";
      if (alertDesc) alertDesc.innerHTML = "Tủ mất (không có tại cửa hàng) bắt buộc phải chụp <b>ảnh vị trí trống/mặt tiền tiệm</b> và nhập <b>Ghi chú lý do chủ tiệm phản hồi</b> trước khi Lưu!";
      if (photoContainer) photoContainer.className = "p-3.5 rounded-2xl border-2 border-red-500 bg-red-50/30 space-y-2.5 transition";
      if (alertBox) alertBox.classList.remove("hidden");
      if (notesBadge) notesBadge.classList.remove("hidden");
    } else if (condition === "Mất tem / Rách mã QR") {
      if (photoBadge) {
        photoBadge.innerHTML = "🔴 BẮT BUỘC CHỤP VỊ TRÍ TEM QR";
        photoBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300 animate-pulse";
      }
      if (guideIcon) guideIcon.textContent = "🏷️";
      if (guideText) guideText.innerHTML = "<b>Góc chụp bắt buộc (Mất/Rách tem QR):</b> Chụp góc dán tem hoặc mã QR bị trầy xước, rách nát để Trade Marketing in cấp lại bộ tem định danh POSM mới.";
      if (alertTitle) alertTitle.textContent = "⚠️ BẮT BUỘC ẢNH & GHI CHÚ KHI MẤT/RÁCH TEM QR:";
      if (alertDesc) alertDesc.innerHTML = "Mất tem hoặc mã QR rách bắt buộc phải chụp <b>ảnh góc tem bị hư hại</b> và ghi chú <b>số serial/barcode còn sót lại</b> trước khi Lưu!";
      if (photoContainer) photoContainer.className = "p-3.5 rounded-2xl border-2 border-red-500 bg-red-50/30 space-y-2.5 transition";
      if (alertBox) alertBox.classList.remove("hidden");
      if (notesBadge) notesBadge.classList.remove("hidden");
    } else if (condition === "Lý do khác") {
      if (photoBadge) {
        photoBadge.innerHTML = "🔴 BẮT BUỘC CHỤP TOÀN CẢNH";
        photoBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300 animate-pulse";
      }
      if (guideIcon) guideIcon.textContent = "⚠️";
      if (guideText) guideText.innerHTML = "<b>Góc chụp bắt buộc (Lý do khác):</b> Chụp toàn cảnh hiện trường vị trí dời tủ, hàng đối thủ để lộn xộn trong tủ tài sản CJ, hoặc biển hiệu đổi chủ tiệm. Bắt buộc nhập ghi chú giải trình.";
      if (alertTitle) alertTitle.textContent = "⚠️ BẮT BUỘC ẢNH & GHI CHÚ GIẢI TRÌNH:";
      if (alertDesc) alertDesc.innerHTML = "Trường hợp lý do khác bắt buộc phải chụp <b>1 ảnh toàn cảnh hiện trường</b> và nhập <b>Ghi chú giải trình chi tiết</b> trước khi Lưu!";
      if (photoContainer) photoContainer.className = "p-3.5 rounded-2xl border-2 border-red-500 bg-red-50/30 space-y-2.5 transition";
      if (alertBox) alertBox.classList.remove("hidden");
      if (notesBadge) notesBadge.classList.remove("hidden");
    } else {
      // Sử Dụng Được (Bắt buộc chụp ảnh 100% theo quy định)
      if (photoBadge) {
        photoBadge.innerHTML = "🔴 BẮT BUỘC CHỤP ẢNH TỦ ĐÔNG";
        photoBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300 animate-pulse";
      }
      if (guideIcon) guideIcon.textContent = "📸";
      if (guideText) guideText.innerHTML = "<b>Góc chụp bắt buộc (Sử dụng được):</b> Bắt buộc chụp ảnh mặt trước tủ trưng bày đầy đủ sản phẩm Bibigo & Cầu Tre đúng chuẩn Planogram tại điểm bán có đóng dấu Watermark GPS.";
      if (photoContainer) photoContainer.className = "p-3.5 rounded-2xl border-2 border-blue-400 bg-blue-50/20 space-y-2.5 transition";
      if (alertBox) alertBox.classList.add("hidden");
      if (notesBadge) notesBadge.classList.add("hidden");

      const notesInput = document.getElementById("auditNotes");
      if (notesInput) {
        notesInput.classList.remove("border-red-500", "ring-2", "ring-red-300");
      }
      const errEl = document.getElementById("notesErrorMsg");
      if (errEl) errEl.classList.add("hidden");
    }

    return isAbnormal;
  },

  openPhotoPolicyModal() {
    const modal = document.getElementById("modalPhotoGuidelines");
    if (modal) modal.classList.remove("hidden");
  },

  closePhotoPolicyModal() {
    const modal = document.getElementById("modalPhotoGuidelines");
    if (modal) modal.classList.add("hidden");
  },

  currentViewMode: "list",
  gsbhMap: null,
  gsbhMarkers: [],
  userLocationMarker: null,

  /**
   * Switch between Card List View and Google My Maps View
   */
  switchViewMode(mode) {
    this.currentViewMode = mode;
    const listView = document.getElementById("subViewStoreList");
    const mapView = document.getElementById("subViewStoreMap");
    const btnList = document.getElementById("btnSwitchListView");
    const btnMap = document.getElementById("btnSwitchMapView");

    if (mode === "map") {
      if (listView) listView.classList.add("hidden");
      if (mapView) mapView.classList.remove("hidden");
      if (btnList) {
        btnList.classList.remove("bg-white", "text-cj-red", "shadow");
        btnList.classList.add("text-gray-600");
      }
      if (btnMap) {
        btnMap.classList.add("bg-white", "text-cj-red", "shadow");
        btnMap.classList.remove("text-gray-600");
      }
      this.initGsbhMap();
    } else {
      if (listView) listView.classList.remove("hidden");
      if (mapView) mapView.classList.add("hidden");
      if (btnList) {
        btnList.classList.add("bg-white", "text-cj-red", "shadow");
        btnList.classList.remove("text-gray-600");
      }
      if (btnMap) {
        btnMap.classList.remove("bg-white", "text-cj-red", "shadow");
        btnMap.classList.add("text-gray-600");
      }
    }
  },

  /**
   * Initialize Leaflet Map (Google My Maps Style)
   */
  initGsbhMap() {
    setTimeout(() => {
      const mapContainer = document.getElementById("gsbhMap");
      if (!mapContainer) return;

      if (!this.gsbhMap) {
        this.gsbhMap = L.map("gsbhMap", {
          zoomControl: true,
          attributionControl: false
        }).setView([10.8015, 106.7082], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19
        }).addTo(this.gsbhMap);
      } else {
        this.gsbhMap.invalidateSize();
      }

      this.renderGsbhMapPins();
    }, 150);
  },

  /**
   * Render Store Pins on the GSBH Map
   */
  renderGsbhMapPins() {
    if (!this.gsbhMap) return;

    // Clear existing markers
    this.gsbhMarkers.forEach(m => this.gsbhMap.removeLayer(m));
    this.gsbhMarkers = [];

    const stores = CJStorage.getStoresForCurrentGSBH(this.selectedSalesRep);
    if (!stores || stores.length === 0) return;

    const bounds = [];

    stores.forEach((store, idx) => {
      if (!store.lat || !store.lng) return;

      bounds.push([store.lat, store.lng]);

      const freezer = CJStorage.getFreezerById(store.freezerId);
      const markerColor = store.status === 'good' ? '#10B981' : (store.status === 'warning' ? '#F59E0B' : '#EF4444');

      const icon = L.divIcon({
        className: 'custom-gsbh-pin',
        html: `
          <div style="background-color: ${markerColor}; width: 34px; height: 34px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 13px;">
            ${idx + 1}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -20]
      });

      const marker = L.marker([store.lat, store.lng], { icon: icon }).addTo(this.gsbhMap);
      marker.storeId = store.id;

      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px; padding: 4px;" class="space-y-2">
          <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 800; color: #E31837;">#${idx + 1} • ${store.id} (${store.channel})</div>
            <div style="font-size: 14px; font-weight: 900; color: #111827; line-height: 1.25; margin-top: 2px;">${store.name}</div>
            <div style="font-size: 11px; color: #4B5563; margin-top: 3px;">📍 ${store.address}</div>
          </div>

          <div style="font-size: 11px; background: #F3F4F6; padding: 6px 8px; border-radius: 8px; line-height: 1.4;">
            <div>👤 <b>NVBH:</b> ${store.salesRep} (${store.salesRepCode || 'NV'})</div>
            <div>📞 <b>SĐT NVBH:</b> <a href="tel:${store.salesRepPhone}" style="color: #2563EB; font-weight: bold;">${store.salesRepPhone || '0903 123 456'}</a></div>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #D1D5DB;">
              ❄️ <b>Tủ CJ:</b> ${freezer ? freezer.assetTag : 'FZ-CJ-001'} (${store.lastTemp || -18}°C)
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;">
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="background: #2563EB; color: white; padding: 8px 4px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: bold; text-align: center; display: block; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              📍 Dẫn Đường
            </a>
            <button onclick="CJAudit.selectStore('${store.id}')" style="background: #E31837; color: white; border: none; padding: 8px 4px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              🔍 Kiểm Tra Tủ
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.gsbhMarkers.push(marker);
    });

    if (bounds.length > 0) {
      this.gsbhMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  },

  /**
   * Center map on specific store and open its popup
   */
  focusStoreOnMap(storeId) {
    this.switchViewMode("map");
    setTimeout(() => {
      const store = CJStorage.getStoreById(storeId);
      if (!store || !this.gsbhMap) return;

      this.gsbhMap.setView([store.lat, store.lng], 16, { animate: true });

      const marker = this.gsbhMarkers.find(m => m.storeId === storeId);
      if (marker) {
        marker.openPopup();
      }
    }, 250);
  },

  /**
   * Locate GSBH's current GPS position on the map
   */
  locateUserOnMap() {
    if (!this.gsbhMap) return;
    if ("geolocation" in navigator) {
      this.showToast("Đang tìm vị trí GPS của bạn...", "info");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.currentGPS = { lat, lng };

          if (this.userLocationMarker) {
            this.gsbhMap.removeLayer(this.userLocationMarker);
          }

          const userIcon = L.divIcon({
            className: 'user-gps-dot',
            html: `
              <div style="position: relative;">
                <div style="width: 22px; height: 22px; border-radius: 50%; background: #2563EB; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>
                <div style="position: absolute; top: -6px; left: -6px; width: 34px; height: 34px; border-radius: 50%; background: rgba(37,99,235,0.3); border-radius: 50%;"></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          this.userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(this.gsbhMap);
          this.userLocationMarker.bindPopup("<b>📍 Vị trí hiện tại của bạn</b>").openPopup();
          this.gsbhMap.setView([lat, lng], 15, { animate: true });
          this.showToast("Đã định vị thành công vị trí hiện tại!", "success");
        },
        (err) => {
          alert("Không thể truy cập GPS: " + err.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Thiết bị không hỗ trợ Geolocation!");
    }
  },

  fitAllStoresOnMap() {
    if (!this.gsbhMap || this.gsbhMarkers.length === 0) return;
    const group = L.featureGroup(this.gsbhMarkers);
    this.gsbhMap.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
  },

  statusFilter: "all",
  searchQuery: "",
  orderCart: {},
  currentOrderStore: null,

  setStatusFilter(filter) {
    this.statusFilter = filter;
    const pills = [
      { id: "pillAllStores", key: "all" },
      { id: "pillActiveStores", key: "active" },
      { id: "pillInactiveStores", key: "inactive" }
    ];

    pills.forEach(p => {
      const el = document.getElementById(p.id);
      if (el) {
        if (p.key === filter) {
          el.className = "pill-filter-btn px-3 py-1.5 rounded-full text-xs font-black transition shadow-sm bg-[#184594] text-white border border-[#184594]";
        } else {
          el.className = "pill-filter-btn px-3 py-1.5 rounded-full text-xs font-bold transition bg-white text-gray-700 hover:bg-gray-50 border border-gray-300";
        }
      }
    });

    this.renderStoreList();
  },

  onSalesRepChange(val) {
    this.selectedSalesRep = val;
    this.renderStoreList();
  },

  clearSearch() {
    const input = document.getElementById("storeSearchInput");
    if (input) input.value = "";
    this.searchQuery = "";
    const clearBtn = document.getElementById("btnClearSearch");
    if (clearBtn) clearBtn.classList.add("hidden");
    this.renderStoreList();
  },

  toggleMapView() {
    if (this.currentViewMode === "list") {
      this.switchViewMode("map");
      const label = document.getElementById("mapToggleLabel");
      if (label) label.textContent = "Danh sách";
    } else {
      this.switchViewMode("list");
      const label = document.getElementById("mapToggleLabel");
      if (label) label.textContent = "Bản đồ";
    }
  },

  activeCategoryFilter: null,

  setActiveCategoryFilter(categoryKey) {
    this.activeCategoryFilter = categoryKey;
    const banner = document.getElementById("activeAuditCategoryBanner");
    const iconEl = document.getElementById("activeCategoryIcon");
    const titleEl = document.getElementById("activeCategoryTitle");
    const guideEl = document.getElementById("activeCategoryGuide");

    const categoryInfo = {
      posm_health: {
        icon: "❄️",
        title: "Đang kiểm tra: Tình trạng Tủ Đông POSM",
        guide: "Chọn cửa hàng bên dưới và bấm [🔍 Kiểm tra] để kiểm tra nhiệt độ, nguồn điện, mã QR."
      },
      planogram_sos: {
        icon: "📐",
        title: "Đang kiểm tra: Trưng Bày Planogram (SOS ≥ 70%)",
        guide: "Kiểm tra tỷ lệ diện tích trưng bày hàng CJ Bibigo & Cầu Tre so với đối thủ."
      },
      promo_compliance: {
        icon: "🎁",
        title: "Đang kiểm tra: Thực Thi Khuyến Mãi & Giá Bán",
        guide: "Kiểm tra dán poster, wobbler CTKM và giá bán lẻ niêm yết tại điểm bán."
      },
      posm_recall: {
        icon: "📦",
        title: "Đang kiểm tra: Rà Soát Thu Hồi & Di Dời POSM",
        guide: "Lập biên bản thu hồi hoặc đề xuất di dời tủ đông tại điểm bán ngừng hoạt động."
      },
      new_outlet: {
        icon: "🏪",
        title: "Đang kiểm tra: Khảo Sát Mở Mới Điểm Bán GT",
        guide: "Khảo sát thực địa và thẩm định cấp đặt tủ đông mới cho tiệm tạp hóa."
      }
    };

    const info = categoryInfo[categoryKey] || {
      icon: "📋",
      title: `Đang kiểm tra: ${categoryKey}`,
      guide: "Chọn cửa hàng bên dưới và bấm [🔍 Kiểm tra] để thực hiện."
    };

    if (banner) banner.classList.remove("hidden");
    if (iconEl) iconEl.textContent = info.icon;
    if (titleEl) titleEl.textContent = info.title;
    if (guideEl) guideEl.textContent = info.guide;

    this.renderStoreList();
  },

  clearActiveCategoryFilter() {
    this.activeCategoryFilter = null;
    const banner = document.getElementById("activeAuditCategoryBanner");
    if (banner) banner.classList.add("hidden");
    this.renderStoreList();
  },

  /**
   * Render store list strictly for the logged-in GSBH matching Image 3 layout
   */
  renderStoreList(filteredStores = null) {
    const container = document.getElementById("storeListContainer");
    if (!container) return;

    const currentUser = CJAuth.getCurrentUser();
    if (!currentUser) return;

    const rawStores = filteredStores || CJStorage.getStoresForCurrentGSBH(this.selectedSalesRep);

    const allCount = rawStores.length;
    const activeCount = rawStores.filter(s => s.isActive !== false).length;
    const inactiveCount = rawStores.filter(s => s.isActive === false).length;

    const pAll = document.getElementById("pillCountAll");
    const pActive = document.getElementById("pillCountActive");
    const pInactive = document.getElementById("pillCountInactive");
    const bannerBadge = document.getElementById("customerBannerBadge");
    const assignedBadge = document.getElementById("assignedStoreCountBadge");

    const uniqueStoresCount = new Set(rawStores.map(s => s.storeCode || s.id)).size;
    if (pAll) pAll.textContent = allCount;
    if (pActive) pActive.textContent = activeCount;
    if (pInactive) pInactive.textContent = inactiveCount;
    if (bannerBadge) bannerBadge.textContent = `GT: ${allCount} Tủ (${uniqueStoresCount} KH)`;
    if (assignedBadge) assignedBadge.textContent = `${allCount} tủ đông (${uniqueStoresCount} KH)`;

    const gsbhTitleEl = document.getElementById("currentGsbhTitle");
    if (gsbhTitleEl) {
      gsbhTitleEl.textContent = `${currentUser.name} (${currentUser.area})`;
    }

    let stores = rawStores;
    if (this.statusFilter === "active") {
      stores = stores.filter(s => s.isActive !== false);
    } else if (this.statusFilter === "inactive") {
      stores = stores.filter(s => s.isActive === false);
    }

    const q = (this.searchQuery || "").toLowerCase().trim();
    if (q) {
      stores = stores.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q)) ||
        (s.storeCode && s.storeCode.toLowerCase().includes(q)) ||
        (s.serialNumber && s.serialNumber.toLowerCase().includes(q)) ||
        (s.barcode && s.barcode.toLowerCase().includes(q)) ||
        (s.model && s.model.toLowerCase().includes(q)) ||
        (s.modelTu && s.modelTu.toLowerCase().includes(q)) ||
        (s.freezerModel && s.freezerModel.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.salesRep && s.salesRep.toLowerCase().includes(q)) ||
        (s.route && s.route.toLowerCase().includes(q))
      );
    }

    // Refresh map pins if map view is currently open
    if (this.currentViewMode === "map" && this.gsbhMap) {
      this.renderGsbhMapPins();
    }

    if (stores.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-gray-300 space-y-2">
          <span class="text-4xl block">🏪</span>
          <p class="font-bold text-gray-800 text-xs">Không tìm thấy khách hàng nào theo điều kiện lọc.</p>
          <p class="text-[11px] text-gray-500">Vui lòng chọn tab "Tất cả" hoặc xóa nội dung tìm kiếm.</p>
        </div>
      `;
      return;
    }

    const allAudits = (typeof CJStorage !== "undefined" && CJStorage.getAudits) ? CJStorage.getAudits() : [];
    const auditMap = new Map();
    allAudits.forEach(a => {
      if (a.storeId && !auditMap.has(a.storeId)) {
        auditMap.set(a.storeId, a);
      }
    });

    container.innerHTML = stores.map((store, idx) => {
      const freezer = CJStorage.getFreezerById(store.freezerId);
      const storeAudit = auditMap.get(store.id);
      const isAudited = Boolean(store.isAudited || storeAudit || (store.lastAuditDate && store.lastAuditDate !== "Chưa kiểm tra"));
      const auditTimeStr = storeAudit ? (storeAudit.auditTime || storeAudit.date) : (store.lastAuditFull || store.lastAuditDate || "");
      const auditorNameStr = storeAudit ? (storeAudit.auditorName || storeAudit.auditorUser || "") : (store.lastAuditor || store.salesRep || store.gsbhName || "");
      const auditCondStr = storeAudit ? (storeAudit.condition || storeAudit.workingCondition || "") : (store.posmCondition || "");

      const isGood = store.status === 'good';
      const isWarning = store.status === 'warning';
      const statusText = isGood ? 'Tủ tốt' : isWarning ? 'Cảnh báo (-14°C)' : 'Sự cố / Hư hỏng';
      const statusColor = isGood ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : isWarning ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;

      return `
        <div class="bg-white rounded-2xl border ${isAudited ? 'border-2 border-emerald-500/80 bg-emerald-50/10' : 'border-gray-200'} p-3.5 sm:p-4 shadow-sm space-y-2.5 hover:border-blue-300 transition">
          
          <!-- Header: Store Name + Status Pill + GT Badge + Audited Status Badge -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span class="text-[10px] bg-red-100 text-cj-red font-black px-1.5 py-0.5 rounded">GT</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${store.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
                  ${store.isActive !== false ? 'Hoạt động' : 'Ngừng'}
                </span>
                <span class="text-[10px] text-gray-500 font-bold">${store.storeCode || store.id}</span>
                ${store.freezerTotal > 1 ? `
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                  ❄️ Tủ ${store.freezerIndex}/${store.freezerTotal}
                </span>
                ` : ''}
                ${isAudited ? `
                <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs flex items-center gap-1 ml-auto">
                  <span>✓</span>
                  <span>ĐÃ KIỂM TRA</span>
                </span>
                ` : `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 ml-auto">
                  Chưa kiểm
                </span>
                `}
              </div>
              <h3 class="font-black text-gray-900 text-sm sm:text-base leading-tight">${store.name}</h3>
            </div>
          </div>

          <!-- Address -->
          <div class="text-xs text-gray-600 flex items-start gap-1">
            <span class="text-red-500 shrink-0">📍</span>
            <span class="line-clamp-2 leading-relaxed font-medium">${store.address}</span>
          </div>

          <!-- Phone & Sales Rep: Nếu có SĐT thì hiện, nếu không có thì để trống -->
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-gray-100">
            ${(store.phone && store.phone.trim() !== '' && store.phone !== '0903000000' && store.phone !== '0903 000 000') ? `
            <div class="flex items-center gap-1 text-gray-700">
              <span>📞</span>
              <a href="tel:${store.phone}" class="font-bold hover:underline text-blue-900" onclick="event.stopPropagation()">${store.phone}</a>
            </div>
            ` : `<div></div>`}
            <div class="text-[11px] text-gray-500 ml-auto">
              👤 NV: <b class="text-gray-800">${store.salesRep || store.gsbhName || 'Chưa phân công'}</b>
            </div>
          </div>

          <!-- POSM Freezer snippet: Hiển thị Model tủ & Barcode Serial -->
          <div class="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-blue-950 font-bold">
                <span class="text-sm">❄️</span>
                <span>Loại tủ:</span>
                <b class="font-extrabold text-blue-900">${store.model || store.modelTu || (freezer && freezer.model) || 'Tủ đông tiêu chuẩn'}</b>
              </div>
              <span class="font-bold px-2 py-0.5 rounded border text-[10px] ${statusColor}">
                ${statusText}
              </span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-700 pt-0.5 border-t border-blue-100/60">
              <div class="flex items-center gap-1">
                <span>🏷️ Barcode (Serial):</span>
                <b class="font-mono text-gray-900 bg-white px-1.5 py-0.5 rounded border border-blue-200 font-extrabold">${store.serialNumber || store.barcode || (freezer && (freezer.serialNumber || freezer.barcode || freezer.assetTag)) || store.freezerId || 'Chưa có barcode'}</b>
              </div>
              ${store.capacity ? `<span class="text-gray-500 font-medium">Dung tích: <b class="text-gray-700">${store.capacity}</b></span>` : ''}
            </div>
          </div>

          <!-- DÒNG THỂ HIỆN RÕ RÀNG TRẠNG THÁI ĐÃ KIỂM TRA (YÊU CẦU NGƯỜI DÙNG) -->
          ${isAudited ? `
          <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-500/80 p-2.5 rounded-xl flex items-center justify-between text-xs shadow-xs">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow shrink-0">✓</span>
              <div>
                <div class="font-black text-emerald-900 text-xs flex items-center gap-1">
                  <span>ĐÃ KIỂM TRA:</span>
                  <span class="text-emerald-700 font-bold">${auditTimeStr || 'Đã hoàn tất'}</span>
                </div>
                <div class="text-[10px] text-emerald-800 font-medium mt-0.5">
                  Người kiểm: <b class="font-extrabold text-emerald-950">${auditorNameStr || 'Nhân sự phụ trách'}</b> ${auditCondStr ? `• Trạng thái: <b class="text-emerald-900">${auditCondStr}</b>` : ''}
                </div>
              </div>
            </div>
            <span class="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shrink-0 shadow-xs">
              ✓ Đã kiểm
            </span>
          </div>
          ` : `
          <div class="bg-amber-50/70 border border-dashed border-amber-300 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div class="flex items-center gap-1.5 font-bold">
              <span>⏳</span>
              <span>Chưa kiểm tra tủ đông tại điểm bán này</span>
            </div>
            <span class="text-[10px] font-black bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-md uppercase">
              Cần kiểm
            </span>
          </div>
          `}

          <!-- CORE ACTION BUTTONS: [🔍 Kiểm tra / 🔄 Kiểm tra lại] + [📍 Maps] -->
          <div class="flex items-center gap-2 pt-1">
            
            <!-- Button 1: Kiểm tra / Kiểm tra lại -->
            <button 
              type="button" 
              onclick="CJAudit.selectStore('${store.id}')" 
              class="flex-1 ${isAudited ? 'bg-emerald-700 hover:bg-emerald-800 border border-emerald-600' : 'bg-[#184594] hover:bg-[#123675]'} text-white font-black text-xs py-2.5 px-3 rounded-xl shadow flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer" 
              title="${isAudited ? 'Xem lại hoặc kiểm tra lại tủ đông tại điểm bán này' : 'Bắt đầu kiểm tra thiết bị tủ đông tại điểm bán'}">
              <span class="text-sm font-black">${isAudited ? '🔄' : '🔍'}</span>
              <span>${isAudited ? 'Kiểm tra lại' : 'Kiểm tra'}</span>
            </button>

            <!-- Button 2: Google Maps Direct Link -->
            <a 
              href="${gmapsUrl}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer" 
              title="Mở Google Maps dẫn đường" 
              onclick="event.stopPropagation()">
              <span>📍</span>
            </a>

          </div>
        </div>
      `;
    }).join("");
  },

  filterStores(query) {
    this.searchQuery = query || "";
    this.renderStoreList();
  },

  filterStoresByChannel(channel) {
    let stores = CJStorage.getStoresForCurrentGSBH(this.selectedSalesRep);
    if (!channel || channel === "ALL") {
      this.renderStoreList(stores);
    } else {
      const filtered = stores.filter(s => s.channel === channel);
      this.renderStoreList(filtered);
    }
  },

  // ================= SELL-OUT ORDERING SYSTEM =================
  openOrderModal(storeId) {
    const store = CJStorage.getStoreById(storeId);
    if (!store) {
      alert("Không tìm thấy thông tin cửa hàng!");
      return;
    }

    this.currentOrderStore = store;

    // Default cart: 5 packs Mandu Thịt Bắp, 2 packs Chả giò Cầu Tre (suggested GT order)
    this.orderCart = {
      "PRD-001": 5,
      "PRD-004": 2
    };

    const subTitleEl = document.getElementById("orderModalStoreSubTitle");
    if (subTitleEl) {
      subTitleEl.textContent = `${store.name} • Tuyến: ${store.route} • NV: ${store.salesRep}`;
    }

    const notesEl = document.getElementById("orderNotesInput");
    if (notesEl) notesEl.value = "";

    this.renderOrderProductRows();

    const modal = document.getElementById("modalOrderSellOut");
    if (modal) modal.classList.remove("hidden");
  },

  closeOrderModal() {
    const modal = document.getElementById("modalOrderSellOut");
    if (modal) modal.classList.add("hidden");
    this.currentOrderStore = null;
  },

  updateOrderQty(productId, delta) {
    const current = this.orderCart[productId] || 0;
    const updated = Math.max(0, current + delta);
    if (updated === 0) {
      delete this.orderCart[productId];
    } else {
      this.orderCart[productId] = updated;
    }
    this.renderOrderProductRows();
  },

  renderOrderProductRows() {
    const container = document.getElementById("orderProductList");
    if (!container) return;

    let totalQty = 0;
    let grossTotal = 0;
    let manduTotal = 0;

    const products = typeof CJ_PRODUCTS !== "undefined" ? CJ_PRODUCTS : [];

    container.innerHTML = products.map(p => {
      const qty = this.orderCart[p.id] || 0;
      const itemSubtotal = qty * p.price;
      totalQty += qty;
      grossTotal += itemSubtotal;
      if (p.id === "PRD-001" || p.id === "PRD-002") {
        manduTotal += qty;
      }

      return `
        <div class="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-2xl border border-gray-200">
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            <span class="text-2xl shrink-0">${p.image}</span>
            <div class="min-w-0">
              <div class="font-extrabold text-xs text-gray-900 truncate leading-tight">${p.name}</div>
              <div class="text-[11px] text-cj-red font-bold">${p.price.toLocaleString('vi-VN')} đ / ${p.unit}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <div class="flex items-center border border-gray-300 rounded-xl bg-white overflow-hidden shadow-sm">
              <button type="button" onclick="CJAudit.updateOrderQty('${p.id}', -1)" class="w-7 h-7 flex items-center justify-center font-black text-gray-600 hover:bg-gray-100 active:scale-90">-</button>
              <span class="w-8 text-center text-xs font-black text-gray-900">${qty}</span>
              <button type="button" onclick="CJAudit.updateOrderQty('${p.id}', 1)" class="w-7 h-7 flex items-center justify-center font-black text-gray-600 hover:bg-gray-100 active:scale-90">+</button>
            </div>
            <div class="w-18 text-right font-black text-xs text-gray-900">
              ${itemSubtotal > 0 ? (itemSubtotal / 1000).toLocaleString('vi-VN') + 'k' : '0 đ'}
            </div>
          </div>
        </div>
      `;
    }).join("");

    let promoReward = "Chưa đạt điều kiện quà tặng";
    let promoDiscount = 0;
    if (manduTotal >= 5) {
      promoReward = "🎁 Tặng 1 Thùng Chả Giò Cầu Tre (trị giá 784.000đ)";
    }

    const netTotal = grossTotal - promoDiscount;

    const qtyEl = document.getElementById("orderTotalQuantity");
    const grossEl = document.getElementById("orderGrossTotal");
    const rewardEl = document.getElementById("orderPromoRewardText");
    const netEl = document.getElementById("orderNetTotal");

    if (qtyEl) qtyEl.textContent = `${totalQty} thùng/gói`;
    if (grossEl) grossEl.textContent = `${grossTotal.toLocaleString('vi-VN')} đ`;
    if (rewardEl) rewardEl.textContent = promoReward;
    if (netEl) netEl.textContent = `${netTotal.toLocaleString('vi-VN')} đ`;
  },

  submitOrder() {
    if (!this.currentOrderStore) return;

    let totalQty = 0;
    let grossTotal = 0;
    const items = [];
    const products = typeof CJ_PRODUCTS !== "undefined" ? CJ_PRODUCTS : [];

    Object.keys(this.orderCart).forEach(prdId => {
      const qty = this.orderCart[prdId];
      if (qty > 0) {
        const prd = products.find(p => p.id === prdId);
        if (prd) {
          totalQty += qty;
          grossTotal += qty * prd.price;
          items.push({
            productId: prd.id,
            productName: prd.name,
            unitPrice: prd.price,
            quantity: qty,
            subtotal: qty * prd.price
          });
        }
      }
    });

    if (totalQty === 0) {
      alert("Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0!");
      return;
    }

    const notes = document.getElementById("orderNotesInput")?.value || "";
    const orderCode = `SO-${Date.now().toString().slice(-6)}`;

    const orderData = {
      id: orderCode,
      storeId: this.currentOrderStore.id,
      storeName: this.currentOrderStore.name,
      items: items,
      totalQty: totalQty,
      grossTotal: grossTotal,
      netTotal: grossTotal,
      notes: notes,
      salesRep: this.currentOrderStore.salesRep,
      createdAt: new Date().toLocaleDateString("vi-VN") + " " + new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
    };

    CJStorage.saveOrder(orderData);
    this.closeOrderModal();
    this.showToast(`🎉 Đã lập đơn hàng ${orderCode} (${totalQty} món - ${grossTotal.toLocaleString('vi-VN')}đ) thành công!`, "success");
    if (typeof CJDashboard !== "undefined" && CJDashboard.refresh) {
      CJDashboard.refresh();
    }
  },

  /**
   * Open the 60-second Audit Form for a selected store
   * Fully safeguarded against any missing DOM element
   */
  selectStore(storeId) {
    try {
      const store = CJStorage.getStoreById(storeId);
      if (!store) {
        alert("Không tìm thấy thông tin điểm bán!");
        return;
      }

      this.currentStore = store;
      this.currentFreezer = CJStorage.getFreezerById(store.freezerId);
      this.currentPhotos = { posm: null, overview: null, tag: null, recall: null };

      // Set Header info
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setTxt("selectedStoreName", store.name);
      setTxt("selectedStoreCode", store.storeCode || store.id);
      setTxt("selectedStoreSalesRep", `NV: ${store.salesRep || 'NVBH'}`);

      const gmapsBtn = document.getElementById("formGmapsDirectLink");
      if (gmapsBtn) {
        gmapsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
      }

      // Barcode selection / populate - Lấy đầy đủ tất cả tủ đông của điểm bán (hỗ trợ CH có nhiều tủ)
      const storeFreezers = (typeof CJStorage !== "undefined" && CJStorage.getFreezersForStore) 
        ? CJStorage.getFreezersForStore(store.id) 
        : [];

      const targetSerial = store.serialNumber || store.barcode || store.freezerId || "TDO03097";
      const targetModel = store.modelTu || store.model || store.freezerModel || "Tủ đông SANAKY 330L";

      const barcodeSelect = document.getElementById("auditBarcodeSelect");
      const freezerModelInput = document.getElementById("auditFreezerModel");

      if (barcodeSelect) {
        barcodeSelect.innerHTML = "";
        if (storeFreezers.length > 0) {
          let hasSelected = false;
          storeFreezers.forEach((fz, idx) => {
            const serial = fz.serialNumber || fz.barcode || fz.assetTag || fz.id;
            const model = fz.modelTu || fz.model || fz.freezerModel || "Tủ đông SANAKY 330L";
            const isMatch = (serial === targetSerial);
            if (isMatch) hasSelected = true;
            const label = storeFreezers.length > 1 
              ? `${serial} • ${model} (Tủ ${fz.freezerIndex || idx + 1}/${fz.freezerTotal || storeFreezers.length})` 
              : `${serial} • ${model}`;
            const opt = new Option(label, serial, isMatch, isMatch);
            opt.dataset.model = model;
            barcodeSelect.add(opt);
          });

          if (!hasSelected && barcodeSelect.options.length > 0) {
            barcodeSelect.options[0].selected = true;
          }

          if (freezerModelInput) {
            freezerModelInput.value = targetModel || (storeFreezers[0].modelTu || storeFreezers[0].model || "Tủ đông SANAKY 330L");
          }
        } else {
          const opt = new Option(`${targetSerial} • ${targetModel}`, targetSerial, true, true);
          opt.dataset.model = targetModel;
          barcodeSelect.add(opt);
          if (freezerModelInput) {
            freezerModelInput.value = targetModel;
          }
        }

        barcodeSelect.onchange = (e) => {
          const selOpt = barcodeSelect.options[barcodeSelect.selectedIndex];
          if (freezerModelInput && selOpt && selOpt.dataset && selOpt.dataset.model) {
            freezerModelInput.value = selOpt.dataset.model;
          }
        };
      }

      // Số lượng POSM: mặc định bằng 1 (kiểm tra cho tủ hiện tại)
      const qtyInput = document.getElementById("auditPosmQuantity");
      if (qtyInput) {
        qtyInput.value = 1;
      }

      const condSelect = document.getElementById("auditPosmCondition");
      if (condSelect) condSelect.value = "Sử Dụng Được";

      const notesInput = document.getElementById("auditNotes");
      if (notesInput) {
        notesInput.value = "";
        notesInput.classList.remove("border-red-500", "ring-2", "ring-red-300");
      }

      const proposalInput = document.getElementById("auditProposal");
      if (proposalInput) proposalInput.value = "";

      // Reset photo previews
      ["posm", "overview", "tag", "recall"].forEach(type => {
        const preview = document.getElementById(`preview_${type}`);
        const placeholder = document.getElementById(`placeholder_${type}`);
        const input = document.getElementById(`photo_input_${type}`);
        if (preview) {
          preview.src = "";
          preview.classList.add("hidden");
        }
        if (placeholder) placeholder.classList.remove("hidden");
        if (input) {
          input.value = "";
          input.classList.remove("hidden");
        }
      });

      const removeBtn = document.getElementById("btnRemovePosmPhoto");
      if (removeBtn) removeBtn.classList.add("hidden");
      const removeOvBtn = document.getElementById("btnRemoveOverviewPhoto");
      if (removeOvBtn) removeOvBtn.classList.add("hidden");

      this.onConditionChange();

      // Switch view
      const storeSelectEl = document.getElementById("stepStoreSelect");
      const auditFormEl = document.getElementById("stepAuditForm");
      if (storeSelectEl) storeSelectEl.classList.add("hidden");
      if (auditFormEl) auditFormEl.classList.remove("hidden");

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Lỗi khi mở form kiểm tra:", err);
      const storeSelectEl = document.getElementById("stepStoreSelect");
      const auditFormEl = document.getElementById("stepAuditForm");
      if (storeSelectEl) storeSelectEl.classList.add("hidden");
      if (auditFormEl) auditFormEl.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  backToStoreList() {
    const auditFormEl = document.getElementById("stepAuditForm");
    const storeSelectEl = document.getElementById("stepStoreSelect");
    if (auditFormEl) auditFormEl.classList.add("hidden");
    if (storeSelectEl) storeSelectEl.classList.remove("hidden");
    this.currentStore = null;
    this.currentFreezer = null;
    window.scrollTo({ top: 120, behavior: "smooth" });
  },

  resetAuditForm() {
    this.selectStore(this.currentStore?.id || "STR-GT-001");
  },

  removePhoto(photoType) {
    this.currentPhotos[photoType] = null;
    const preview = document.getElementById(`preview_${photoType}`);
    const placeholder = document.getElementById(`placeholder_${photoType}`);
    if (preview) {
      preview.src = "";
      preview.classList.add("hidden");
    }
    if (placeholder) placeholder.classList.remove("hidden");
    const input = document.getElementById(`photo_input_${photoType}`);
    if (input) {
      input.value = "";
      input.classList.remove("hidden");
    }
    if (photoType === "posm") {
      const removeBtn = document.getElementById("btnRemovePosmPhoto");
      if (removeBtn) removeBtn.classList.add("hidden");
    } else if (photoType === "overview") {
      const removeBtn = document.getElementById("btnRemoveOverviewPhoto");
      if (removeBtn) removeBtn.classList.add("hidden");
    } else if (photoType === "recall") {
      const removeBtn = document.getElementById("btnRemoveRecallPhoto");
      if (removeBtn) removeBtn.classList.add("hidden");
    }
  },

  currentCameraPhotoType: "posm",
  currentCameraStream: null,
  currentFacingMode: "environment",

  triggerCapture(photoType = "posm") {
    // If photo already exists, don't reopen camera unless removed
    if (this.currentPhotos[photoType]) return;

    // Check WebRTC MediaDevices support
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
      this.openLiveCamera(photoType);
    } else {
      // Direct file input fallback
      const input = document.getElementById(`photo_input_${photoType}`);
      if (input) input.click();
    }
  },

  async openLiveCamera(photoType = "posm") {
    this.currentCameraPhotoType = photoType;
    const modal = document.getElementById("liveCameraModal");
    const title = document.getElementById("liveCameraTitle");
    const helper = document.getElementById("liveCameraHelper");

    const titles = {
      posm: "📸 Chụp hình 1: Tủ đông & Barcode",
      overview: "📸 Chụp hình 2: Tổng quan cửa hàng",
      recall: "📸 Chụp hình: Hiện trạng tủ thu hồi"
    };
    const helpers = {
      posm: "tủ đông, tem barcode & sản phẩm Bibigo",
      overview: "toàn cảnh mặt tiền & biển hiệu cửa hàng",
      recall: "hiện trạng trầy xước/móp méo và bàn giao"
    };

    if (title) title.textContent = titles[photoType] || "Chụp ảnh kiểm tra thực địa";
    if (helper) helper.textContent = helpers[photoType] || "thiết bị điểm bán";

    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }

    await this.startCameraStream();
  },

  async startCameraStream() {
    const video = document.getElementById("liveCameraVideo");
    if (!video) return;

    if (this.currentCameraStream) {
      this.currentCameraStream.getTracks().forEach(t => t.stop());
      this.currentCameraStream = null;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.currentFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentCameraStream = stream;
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      console.warn("Lỗi mở camera WebRTC:", err);
      this.closeLiveCamera();
      this.showToast("Không thể mở máy ảnh trực tiếp (" + err.message + "). Chuyển sang máy ảnh hệ thống...", "warning");
      const fallbackInput = document.getElementById(`photo_input_${this.currentCameraPhotoType}`);
      if (fallbackInput) fallbackInput.click();
    }
  },

  async switchCameraFacing() {
    this.currentFacingMode = (this.currentFacingMode === "environment") ? "user" : "environment";
    await this.startCameraStream();
  },

  closeLiveCamera() {
    const modal = document.getElementById("liveCameraModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    if (this.currentCameraStream) {
      this.currentCameraStream.getTracks().forEach(t => t.stop());
      this.currentCameraStream = null;
    }
  },

  async captureFromLiveCamera() {
    const video = document.getElementById("liveCameraVideo");
    if (!video) return;

    try {
      this.showToast("Đang xử lý ảnh & đóng dấu Watermark GPS...", "info");

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL("image/jpeg", 0.9);

      this.closeLiveCamera();

      const metadata = this.buildWatermarkMetadata(this.currentCameraPhotoType);
      const watermarkedDataUrl = await CJWatermark.processImage(rawDataUrl, metadata);
      this.setPhotoPreview(this.currentCameraPhotoType, watermarkedDataUrl);
      this.showToast("Đã chụp và đóng dấu Watermark thành công!", "success");
    } catch (err) {
      console.error("Lỗi chụp ảnh từ live camera:", err);
      this.showToast("Lỗi xử lý ảnh: " + err.message, "error");
    }
  },

  handleFallbackFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.closeLiveCamera();
    this.handlePhotoUpload(event, this.currentCameraPhotoType);
  },

  async handlePhotoUpload(event, photoType) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.showToast("Đang xử lý ảnh & đóng dấu Watermark...", "info");
      const metadata = this.buildWatermarkMetadata(photoType);
      const watermarkedDataUrl = await CJWatermark.processImage(file, metadata);
      this.setPhotoPreview(photoType, watermarkedDataUrl);
      this.showToast("Đã đóng dấu Watermark thành công!", "success");
    } catch (err) {
      console.error(err);
      this.showToast("Lỗi xử lý ảnh: " + err.message, "error");
    }
  },

  async generateMockPhoto(photoType) {
    const metadata = this.buildWatermarkMetadata(photoType);
    const cond = document.getElementById("auditPosmCondition")?.value || "Sử Dụng Được";
    let typeStatus = cond === "Sử Dụng Được" ? "good" : "danger";
    let label = `Ảnh Tủ Đông (${metadata.assetTag})`;

    if (photoType === "overview") {
      typeStatus = "good";
      label = `Ảnh Tổng Quan (${metadata.storeName || 'Cửa Hàng'})`;
    } else if (photoType === "recall") {
      typeStatus = "warning";
      label = `Ảnh Thu Hồi (${metadata.assetTag})`;
    }

    const placeholder = CJWatermark.generatePlaceholderImage(typeStatus, label);
    const watermarkedDataUrl = await CJWatermark.processImage(placeholder, metadata);
    this.setPhotoPreview(photoType, watermarkedDataUrl);
    const photoTypeName = photoType === 'posm' ? 'tủ đông' : (photoType === 'overview' ? 'tổng quan cửa hàng' : 'thu hồi');
    this.showToast(`Đã tạo ảnh ${photoTypeName} có Watermark GPS!`, "success");
  },

  buildWatermarkMetadata(photoType = "posm") {
    const user = CJAuth.getCurrentUser() || { name: "Admin" };
    const barcode = document.getElementById("auditBarcodeSelect")?.value || (this.currentFreezer ? this.currentFreezer.barcode || this.currentFreezer.assetTag : "TDO2603_0025");
    const condition = document.getElementById("auditPosmCondition")?.value || "Sử Dụng Được";

    let reasonStr = "KIỂM TRA ĐỊNH KỲ";
    if (photoType === "posm") {
      reasonStr = condition === "Sử Dụng Được" ? "HÌNH ẢNH TỦ ĐÔNG TRƯNG BÀY" : `SỰ CỐ TỦ ĐÔNG: ${condition.toUpperCase()}`;
    } else if (photoType === "overview") {
      reasonStr = "HÌNH ẢNH TỔNG QUAN CỬA HÀNG";
    } else if (photoType === "recall") {
      reasonStr = "THU HỒI POSM VỀ KHO NPP";
    } else if (condition !== "Sử Dụng Được") {
      reasonStr = `SỰ CỐ: ${condition.toUpperCase()}`;
    }

    return {
      storeId: this.currentStore ? this.currentStore.id : "STR-GT",
      storeName: this.currentStore ? this.currentStore.name : "Điểm bán GT",
      channel: "GT",
      address: this.currentStore ? this.currentStore.address : "TP. Hồ Chí Minh",
      lat: this.currentStore ? this.currentStore.lat : this.currentGPS.lat,
      lng: this.currentStore ? this.currentStore.lng : this.currentGPS.lng,
      assetTag: barcode,
      temp: condition === "Sử Dụng Được" ? "Hoạt Động Tốt" : condition,
      photoReason: reasonStr,
      timestamp: new Date().toLocaleString("vi-VN", { hour12: false }),
      auditor: `${user.name} (GSBH GT) | NV: ${this.currentStore?.salesRep || 'NVBH'}`
    };
  },

  setPhotoPreview(photoType, dataUrl) {
    this.currentPhotos[photoType] = dataUrl;
    const previewImg = document.getElementById(`preview_${photoType}`);
    const placeholder = document.getElementById(`placeholder_${photoType}`);
    if (previewImg) {
      previewImg.src = dataUrl;
      previewImg.classList.remove("hidden");
    }
    if (placeholder) {
      placeholder.classList.add("hidden");
    }
    const input = document.getElementById(`photo_input_${photoType}`);
    if (input) {
      input.classList.add("hidden");
    }
    if (photoType === "posm") {
      const removeBtn = document.getElementById("btnRemovePosmPhoto");
      if (removeBtn) removeBtn.classList.remove("hidden");
    } else if (photoType === "overview") {
      const removeBtn = document.getElementById("btnRemoveOverviewPhoto");
      if (removeBtn) removeBtn.classList.remove("hidden");
    } else if (photoType === "recall") {
      const removeBtn = document.getElementById("btnRemoveRecallPhoto");
      if (removeBtn) removeBtn.classList.remove("hidden");
    }
  },

  openPhotoModal(photoType) {
    const dataUrl = this.currentPhotos[photoType];
    if (!dataUrl) return;

    const modal = document.getElementById("photoViewModal");
    const modalImg = document.getElementById("modalPhotoImg");
    if (modal && modalImg) {
      modalImg.src = dataUrl;
      modal.classList.remove("hidden");
    }
  },

  closePhotoModal() {
    const modal = document.getElementById("photoViewModal");
    if (modal) modal.classList.add("hidden");
  },

  /**
   * Submit Audit POSM / Thiết Bị Kênh GT (Theo màn hình mẫu):
   * 1. Barcode *
   * 2. Số lượng POSM *
   * 3. Đánh giá tình trạng *
   * 4. Ghi chú (Bắt buộc khi có sự cố/lý do khác)
   * 5. Đề nghị
   * 6. Hình ảnh POSM (Bắt buộc khi có sự cố/lý do khác)
   */
  async submitAudit() {
    if (!this.currentStore) {
      alert("Vui lòng chọn điểm bán trước khi lưu!");
      return;
    }

    const barcode = document.getElementById("auditBarcodeSelect")?.value || this.currentStore?.serialNumber || this.currentStore?.barcode || "TDO03097";
    const modelTu = document.getElementById("auditFreezerModel")?.value || this.currentStore?.modelTu || "Tủ đông SANAKY 330L";
    const quantity = parseInt(document.getElementById("auditPosmQuantity")?.value || "1", 10);
    const condition = document.getElementById("auditPosmCondition")?.value || "Sử Dụng Được";
    const notes = (document.getElementById("auditNotes")?.value || "").trim();
    const proposal = (document.getElementById("auditProposal")?.value || "").trim();

    const isAbnormal = condition !== "Sử Dụng Được";

    // ================= STRICT VALIDATION THEO YÊU CẦU =================
    // 1. Kiểm tra Ghi chú (bắt buộc khi bất thường / hư hỏng / mất tủ / lý do khác)
    if (isAbnormal) {
      if (!notes) {
        const errEl = document.getElementById("notesErrorMsg");
        if (errEl) errEl.classList.remove("hidden");
        const notesInput = document.getElementById("auditNotes");
        if (notesInput) {
          notesInput.classList.add("border-red-500", "ring-2", "ring-red-300");
          notesInput.focus();
        }
        alert(`⚠️ BẮT BUỘC NHẬP GHI CHÚ:\nBạn đã chọn tình trạng [${condition}]. Vui lòng nhập nội dung ghi chú mô tả hiện trạng tại điểm bán!`);
        return;
      }
    }

    // 2. Bắt buộc chụp tối thiểu 2 hình khi kiểm tra: 1 tấm hình tủ đông, 1 tấm tổng quan cửa hàng
    const hasPosmPhoto = !!this.currentPhotos.posm;
    const hasOverviewPhoto = !!this.currentPhotos.overview;

    if (!hasPosmPhoto || !hasOverviewPhoto) {
      let msg = "⚠️ YÊU CẦU BẮT BUỘC CHỤP TỐI THIỂU 2 HÌNH KHI KIỂM TRA:\n\n";
      if (!hasPosmPhoto && !hasOverviewPhoto) {
        msg += "❌ Chưa chụp: [1. Hình ảnh tủ đông]\n";
        msg += "❌ Chưa chụp: [2. Hình tổng quan cửa hàng]\n\n";
        msg += "👉 Quy định bắt buộc phải có đủ 2 ảnh (Tủ đông & Tổng quan điểm bán) có Watermark GPS trước khi bấm Lưu!";
      } else if (!hasPosmPhoto) {
        msg += "❌ Còn thiếu: [1. Hình ảnh tủ đông] (Cận cảnh tủ & sản phẩm/barcode)\n";
        msg += "✅ Đã có: [2. Hình tổng quan cửa hàng]\n\n";
        msg += "👉 Vui lòng chụp/tải thêm [Hình ảnh tủ đông] để hoàn tất biên bản kiểm tra!";
      } else {
        msg += "✅ Đã có: [1. Hình ảnh tủ đông]\n";
        msg += "❌ Còn thiếu: [2. Hình tổng quan cửa hàng] (Toàn cảnh mặt tiền/biển hiệu)\n\n";
        msg += "👉 Vui lòng chụp/tải thêm [Hình tổng quan cửa hàng] để hoàn tất biên bản kiểm tra!";
      }

      alert(msg);
      const photoSection = document.getElementById("sectionPhotoEvidence");
      if (photoSection) photoSection.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const user = CJAuth.getCurrentUser() || { name: "Nhân Viên GSBH", username: "user", roleTitle: "GSBH GT", area: "Khu vực" };
    let ticketDetails = null;

    if (isAbnormal) {
      const ticketId = `TCK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const isMissing = condition === "Mất (ko có tại cửa hàng)" || condition === "Không hoạt động";
      ticketDetails = {
        ticketId: ticketId,
        priority: (condition === "Hư hỏng" || isMissing) ? "CRITICAL" : "MEDIUM",
        issueType: `${condition} (${barcode})` + (notes ? `: ${notes}` : ""),
        status: "OPEN",
        assignedTo: isMissing ? "Bộ Phận Pháp Lý & Quản Trị Tài Sản CJ" : "Đội Kỹ Thuật Điện Lạnh CJ",
        createdAt: new Date().toLocaleString("vi-VN")
      };

      try {
        if (typeof CJStorage !== "undefined" && typeof CJStorage.saveTicket === "function") {
          CJStorage.saveTicket(ticketDetails);
        }
      } catch (errTicket) {
        console.warn("Lỗi lưu ticket:", errTicket);
      }
    }

    const auditData = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      storeId: this.currentStore.id,
      storeName: this.currentStore.name,
      channel: "GT",
      barcode: barcode,
      modelTu: modelTu,
      posmQuantity: quantity,
      condition: condition,
      notes: notes,
      proposal: proposal,
      ticketCreated: isAbnormal,
      ticketDetails: ticketDetails,
      photos: { ...this.currentPhotos },
      auditTime: new Date().toLocaleString("vi-VN"),
      auditorName: `${user.name} (${user.roleTitle || 'GSBH GT'})`,
      gsbhUsername: user.username,
      gps: { lat: this.currentStore.lat, lng: this.currentStore.lng }
    };

    // Update store state
    try {
      const storeObj = CJStorage.getStoreById(this.currentStore.id);
      if (storeObj) {
        storeObj.status = isAbnormal ? "danger" : "good";
        storeObj.isAudited = true;
        const now = new Date();
        storeObj.lastAuditDate = now.toLocaleDateString("vi-VN");
        storeObj.lastAuditTime = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        storeObj.lastAuditFull = `${storeObj.lastAuditTime} ${storeObj.lastAuditDate}`;
        storeObj.lastAuditor = user.name;
        storeObj.posmCondition = condition;
        if (CJStorage.updateStore) CJStorage.updateStore(storeObj);
        else if (CJStorage.saveStore) CJStorage.saveStore(storeObj);
      }
    } catch (errStore) {
      console.warn("Store update error:", errStore);
    }

    try {
      CJStorage.saveAudit(auditData);
    } catch (errAudit) {
      console.warn("Audit save error:", errAudit);
    }

    // Cập nhật giao diện & KPI Dashboard tức thì (< 0.1 giây)
    if (typeof CJDashboard !== "undefined") {
      CJDashboard.refresh();
    }
    this.renderStoreList();

    // Hiển thị ngay màn hình biên lai thành công (Không chờ mạng, không đóng băng ứng dụng)
    this.showAuditSuccessModal(auditData);

    // Đồng bộ ngầm (Background Sync) lên Google Sheets & Google Drive
    if (typeof CJCloudSync !== "undefined") {
      const syncPayload = {
        timestamp: new Date().toISOString(),
        userCode: user?.username || "",
        userName: user?.name || "",
        region: user?.area || user?.region || "",
        customerCode: this.currentStore.storeCode || this.currentStore.id || "",
        customerName: this.currentStore.originalStoreName || this.currentStore.name || "",
        address: this.currentStore.address || "",
        phone: this.currentStore.phone || "",
        freezerBarcode: barcode,
        freezerModel: modelTu,
        freezerQuantity: quantity,
        workingCondition: condition,
        conditionNote: notes,
        latitude: this.currentStore.lat || "",
        longitude: this.currentStore.lng || "",
        distanceMeters: this.currentStore.distance || "",
        photo: this.currentPhotos.posm || "",
        photoPosm: this.currentPhotos.posm || "",
        photoOverview: this.currentPhotos.overview || ""
      };

      CJCloudSync.sendAuditToGoogleSheet(syncPayload).then((cloudResult) => {
        const syncStatusEl = document.getElementById("modalResultSyncStatus");
        if (syncStatusEl) {
          if (cloudResult && cloudResult.success) {
            syncStatusEl.className = "flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 py-2 px-3 rounded-xl border border-emerald-200";
            syncStatusEl.innerHTML = `<span>✅ Đã đồng bộ Google Sheets & Drive thành công!</span>`;
          } else {
            syncStatusEl.className = "flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 py-2 px-3 rounded-xl border border-amber-200";
            syncStatusEl.innerHTML = `<span>💾 Đã lưu an toàn trên máy (tự động gửi lại khi có mạng)</span>`;
          }
        }
      }).catch((errSync) => {
        console.warn("Cloud sync error:", errSync);
        const syncStatusEl = document.getElementById("modalResultSyncStatus");
        if (syncStatusEl) {
          syncStatusEl.className = "flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 py-2 px-3 rounded-xl border border-amber-200";
          syncStatusEl.innerHTML = `<span>💾 Đã lưu an toàn trên máy (tự động gửi lại khi có mạng)</span>`;
        }
      });
    }
  },

  // ================= MODAL THU HỒI POSM =================
  openRecallModal() {
    if (!this.currentStore) {
      alert("Vui lòng chọn điểm bán trước khi đề xuất thu hồi!");
      return;
    }

    const storeNameEl = document.getElementById("recallStoreName");
    if (storeNameEl) storeNameEl.textContent = this.currentStore.name;

    const barcodeEl = document.getElementById("recallBarcode");
    const curBarcode = document.getElementById("auditBarcodeSelect")?.value || "TDO2603_0025";
    if (barcodeEl) barcodeEl.textContent = curBarcode;

    const notesEl = document.getElementById("recallNotes");
    if (notesEl) notesEl.value = "";

    // Reset recall photo slot
    this.currentPhotos.recall = null;
    const preview = document.getElementById("preview_recall");
    const placeholder = document.getElementById("placeholder_recall");
    const removeBtn = document.getElementById("btnRemoveRecallPhoto");
    if (preview) { preview.src = ""; preview.classList.add("hidden"); }
    if (placeholder) { placeholder.classList.remove("hidden"); }
    if (removeBtn) { removeBtn.classList.add("hidden"); }

    const modal = document.getElementById("modalRecallPosm");
    if (modal) modal.classList.remove("hidden");
  },

  closeRecallModal() {
    const modal = document.getElementById("modalRecallPosm");
    if (modal) modal.classList.add("hidden");
  },

  confirmRecallPosm() {
    if (!this.currentStore) return;

    // Strict photo validation for Recall POSM:
    if (!this.currentPhotos.recall) {
      alert("⚠️ BẮT BUỘC CHỤP ẢNH HIỆN TRẠNG TỦ THU HỒI (100%):\nTrước khi lập phiếu thu hồi về kho NPP, bắt buộc phải chụp ít nhất 1 ảnh hiện trạng tủ (có đóng dấu Watermark GPS) để xác nhận trầy xước, móp méo và hàng hóa bàn giao!");
      return;
    }

    const barcode = document.getElementById("auditBarcodeSelect")?.value || "TDO2603_0025";
    const reason = document.getElementById("recallReasonSelect")?.value || "store_closed";
    const receiver = document.getElementById("recallReceiverSelect")?.value || "npp_logistics";
    const notes = (document.getElementById("recallNotes")?.value || "").trim();
    const user = CJAuth.getCurrentUser();

    const ticketId = `TCK-RECALL-${Date.now().toString().slice(-4)}`;
    const recallTicket = {
      ticketId: ticketId,
      storeId: this.currentStore.id,
      storeName: this.currentStore.name,
      barcode: barcode,
      type: "RECALL_POSM",
      priority: "HIGH",
      reason: reason,
      receiver: receiver,
      notes: notes,
      photo: this.currentPhotos.recall,
      requester: `${user.name} (GSBH GT)`,
      status: "PENDING_RECALL",
      createdAt: new Date().toLocaleString("vi-VN")
    };

    try {
      if (typeof CJStorage !== "undefined" && typeof CJStorage.saveTicket === "function") {
        CJStorage.saveTicket(recallTicket);
      }
    } catch (eRecall) {
      console.warn("Recall ticket save warning:", eRecall);
    }
    this.closeRecallModal();
    this.showToast(`Đã lập phiếu đề xuất thu hồi POSM "${barcode}" kèm ảnh thành công!`, "success");

    // Update store status to warning
    const storeObj = CJStorage.getStoreById(this.currentStore.id);
    if (storeObj) {
      storeObj.status = "warning";
      CJStorage.saveStore(storeObj);
    }
    if (typeof CJDashboard !== "undefined") {
      CJDashboard.refresh();
    }
  },

  showAuditSuccessModal(audit) {
    const modal = document.getElementById("auditSuccessModal");
    if (!modal) return;

    const setTxt = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setTxt("modalResultStore", audit.storeName);
    setTxt("modalResultBarcode", audit.barcode || "TDO2603_0025");
    setTxt("modalResultQty", audit.posmQuantity || 1);

    const syncStatusEl = document.getElementById("modalResultSyncStatus");
    if (syncStatusEl) {
      syncStatusEl.className = "flex items-center justify-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 py-2 px-3 rounded-xl border border-blue-200";
      syncStatusEl.innerHTML = `
        <svg class="animate-spin h-3.5 w-3.5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Đang đồng bộ dữ liệu & ảnh ngầm lên Google Sheets...</span>
      `;
    }

    const condEl = document.getElementById("modalResultCondition");
    if (condEl) {
      condEl.textContent = audit.condition || "Sử Dụng Được";
      condEl.className = audit.condition === "Sử Dụng Được" 
        ? "font-black text-emerald-700" 
        : "font-black text-red-600";
    }

    const notesRow = document.getElementById("modalResultNotesRow");
    const notesEl = document.getElementById("modalResultNotes");
    if (audit.notes && audit.notes.trim().length > 0) {
      if (notesRow) notesRow.classList.remove("hidden");
      if (notesEl) notesEl.textContent = `"${audit.notes}"`;
    } else {
      if (notesRow) notesRow.classList.add("hidden");
    }

    const propRow = document.getElementById("modalResultProposalRow");
    const propEl = document.getElementById("modalResultProposal");
    if (audit.proposal && audit.proposal.trim().length > 0) {
      if (propRow) propRow.classList.remove("hidden");
      if (propEl) propEl.textContent = audit.proposal;
    } else {
      if (propRow) propRow.classList.add("hidden");
    }

    const ticketBox = document.getElementById("modalResultTicketBox");
    if (audit.ticketCreated && audit.ticketDetails) {
      if (ticketBox) ticketBox.classList.remove("hidden");
      setTxt("modalResultTicketId", audit.ticketDetails.ticketId);
      setTxt("modalResultTicketIssue", audit.ticketDetails.issueType);
    } else {
      if (ticketBox) ticketBox.classList.add("hidden");
    }

    const posmImg = document.getElementById("modalResultPosmPhoto");
    const ovImg = document.getElementById("modalResultOverviewPhoto");
    if (posmImg && audit.photos?.posm) {
      posmImg.src = audit.photos.posm;
    }
    if (ovImg && audit.photos?.overview) {
      ovImg.src = audit.photos.overview;
    }

    modal.classList.remove("hidden");
    modal.style.display = "flex";
  },

  closeSuccessModal() {
    const modal = document.getElementById("auditSuccessModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    this.backToStoreList();
    this.renderStoreList();
  },

  showToast(message, type = "info") {
    const toast = document.getElementById("appToast");
    if (!toast) return;

    const bgColors = {
      info: "bg-blue-600 text-white",
      success: "bg-emerald-600 text-white",
      warning: "bg-amber-500 text-white",
      error: "bg-red-600 text-white"
    };

    toast.className = `fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 transition-all transform duration-300 font-medium text-sm ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
    toast.classList.remove("opacity-0", "translate-y-[-20px]", "pointer-events-none");

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-[-20px]", "pointer-events-none");
    }, 3500);
  }
};
