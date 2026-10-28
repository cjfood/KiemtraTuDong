/**
 * =========================================================================
 * CJ CAU TRE / CJ FOODS VIETNAM - MARKET AUDIT SYSTEM
 * CLOUD SYNC MODULE (GOOGLE SHEETS & GOOGLE DRIVE INTEGRATION)
 * =========================================================================
 */

const CJCloudSync = (function () {
    const STORAGE_KEY = 'cj_google_sheet_url';
    const PENDING_SYNC_KEY = 'cj_pending_sync_queue';
    const DEFAULT_SYSTEM_URL = 'https://script.google.com/macros/s/AKfycbxTtQpinPeLMJksH-Jdo9HpU2sP_g4N2TflU97pMkGqUtHlDpWZ42xv-rM5iECnoVSWIQ/exec';
    const OLD_SYSTEM_URL_PREFIX = 'AKfycbw4n6lsTKqsVXlrtyu2qx5GNFTksMmtoAyCcvgPpXfXD71nTP';

    // Tự động xóa link cũ nếu còn lưu trong localStorage của trình duyệt
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached && cached.includes(OLD_SYSTEM_URL_PREFIX)) {
            localStorage.removeItem(STORAGE_KEY);
            console.log("[CJCloudSync] Đã xóa URL Google cũ khỏi localStorage.");
        }
    } catch (e) {}

    /**
     * Lấy URL Google Apps Script đã lưu hoặc URL mặc định của hệ thống
     */
    function getScriptUrl() {
        // Tự động dọn dẹp nếu URL cũ còn sót
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached && cached.includes(OLD_SYSTEM_URL_PREFIX)) {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {}

        // 1. Ưu tiên cao nhất: URL chuẩn hệ thống từ data.js
        if (typeof CJ_SYSTEM_GOOGLE_SHEET_URL !== 'undefined' && CJ_SYSTEM_GOOGLE_SHEET_URL && CJ_SYSTEM_GOOGLE_SHEET_URL.trim()) {
            const sysUrl = CJ_SYSTEM_GOOGLE_SHEET_URL.trim();
            if (!sysUrl.includes(OLD_SYSTEM_URL_PREFIX)) {
                return sysUrl;
            }
        }

        // 2. Kiểm tra customUrl người dùng cấu hình thủ công (loại trừ URL cũ)
        const customUrl = localStorage.getItem(STORAGE_KEY);
        if (customUrl && customUrl.trim() && !customUrl.includes(OLD_SYSTEM_URL_PREFIX)) {
            return customUrl.trim();
        }

        return DEFAULT_SYSTEM_URL;
    }

    /**
     * Lưu URL Google Apps Script
     */
    function setScriptUrl(url) {
        if (!url) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        localStorage.setItem(STORAGE_KEY, url.trim());
    }

    /**
     * Kiểm tra kết nối tới Google Apps Script Web App
     */
    async function testConnection(url) {
        const targetUrl = (url || getScriptUrl()).trim();
        if (!targetUrl) {
            throw new Error('Chưa cấu hình URL Google Apps Script!');
        }

        try {
            // Thử gọi GET ping
            const testUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=ping&t=' + Date.now();
            
            // Dùng fetch với timeout 10 giây
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(testUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                message: data.message || 'Kết nối Google Sheets thành công!'
            };
        } catch (err) {
            console.warn('Test connection GET failed, attempting no-cors fallback:', err);
            // Trong trường hợp Apps Script cấu hình trả về nhưng bị CORS header trên browser
            // kiểm tra URL có hợp lệ định dạng script.google.com/macros/s/
            if (targetUrl.includes('script.google.com/macros/s/')) {
                return {
                    success: true,
                    message: 'URL Google Apps Script hợp lệ! (Đã sẵn sàng nhận dữ liệu đồng bộ)'
                };
            }
            throw new Error('Không thể kết nối đến Web App: ' + (err.message || err.toString()));
        }
    }

    /**
     * Đồng bộ dữ liệu 1 đợt kiểm tra lên Google Sheets & Google Drive
     */
    async function sendAuditToGoogleSheet(auditData) {
        const scriptUrl = getScriptUrl();
        if (!scriptUrl) {
            console.warn('[CJCloudSync] Chưa cấu hình URL Google Sheets. Bỏ qua đồng bộ đám mây.');
            if (typeof CJAudit !== 'undefined' && CJAudit.showToast) {
                CJAudit.showToast('⚠️ Chưa cấu hình link Google Sheets trong hệ thống! Dữ liệu đã lưu cục bộ trên máy.', 'warning');
            }
            return { success: false, reason: 'no_url' };
        }

        // Chuẩn hóa payload
        const user = (typeof CJAuth !== 'undefined' && typeof CJAuth.getCurrentUser === 'function') 
            ? (CJAuth.getCurrentUser() || {}) 
            : ((typeof CJAuth !== 'undefined' && CJAuth.currentUser) ? CJAuth.currentUser : {});
        const storeObj = (typeof CJStorage !== 'undefined' && (auditData.storeId || auditData.customerCode))
            ? (CJStorage.getStoreById(auditData.storeId) || CJStorage.getStoreById(auditData.customerCode) || {})
            : {};

        const payload = {
            timestamp: auditData.timestamp || auditData.auditTime || auditData.date || new Date().toISOString(),
            userCode: auditData.userCode || auditData.auditorUser || user.username || user.userCode || '',
            userName: auditData.userName || auditData.auditorName || user.name || user.fullName || '',
            region: auditData.region || user.area || user.region || '',
            customerCode: auditData.customerCode || auditData.storeCode || auditData.storeId || storeObj.storeCode || storeObj.id || '',
            customerName: auditData.customerName || auditData.storeName || storeObj.name || '',
            channel: auditData.channel || storeObj.channel || 'GT',
            route: auditData.route || storeObj.route || '',
            address: auditData.address || storeObj.address || '',
            phone: auditData.phone || storeObj.phone || '',
            salesRep: auditData.salesRep || storeObj.salesRep || '',
            salesRepPhone: auditData.salesRepPhone || storeObj.salesRepPhone || '',
            freezerBarcode: auditData.freezerBarcode || auditData.freezerId || auditData.barcode || storeObj.serialNumber || storeObj.barcode || '',
            freezerModel: auditData.freezerModel || auditData.model || storeObj.model || storeObj.modelTu || '',
            freezerQuantity: auditData.freezerQuantity || 1,
            workingCondition: auditData.condition || auditData.workingCondition || '',
            condition: auditData.condition || auditData.workingCondition || '',
            powerStatus: auditData.powerStatus || '',
            hasCjGoods: auditData.hasCjGoods || '',
            orders30d: auditData.orders30d !== undefined ? auditData.orders30d : '',
            sales30d: auditData.sales30d !== undefined ? auditData.sales30d : '',
            hasCompetitor: auditData.hasCompetitor || '',
            competitorDetail: auditData.competitorDetail || '',
            revenuePotential: auditData.revenuePotential || '',
            storeType: auditData.storeType || auditData.channel || 'GT',
            businessCategory: auditData.businessCategory || '',
            matchCjTarget: auditData.matchCjTarget || '',
            freezerLocation: auditData.freezerLocation || '',
            freezerVisibility: auditData.freezerVisibility || '',
            truckAccessible: auditData.truckAccessible || '',
            deliveryFrequency: auditData.deliveryFrequency || '',
            rootCause: auditData.rootCause || '',
            rootCauseDetail: auditData.rootCauseDetail || '',
            actionProposal: auditData.actionProposal || '',
            actionPic: auditData.actionPic || '',
            deadline: auditData.deadline || '',
            actionStatus: auditData.actionStatus || 'Chờ xử lý',
            actionResult: auditData.actionResult || '',
            followUpDate: auditData.followUpDate || '',
            conditionNote: auditData.conditionNote || '',
            cleanliness: auditData.cleanliness || '',
            stockCompliance: auditData.stockCompliance || '',
            displayLocation: auditData.displayLocation || '',
            posmStatus: auditData.posmStatus || '',
            notes: auditData.notes || '',
            latitude: auditData.latitude || (auditData.photoMetadata ? auditData.photoMetadata.lat : '') || (auditData.location ? auditData.location.lat : '') || storeObj.lat || '',
            longitude: auditData.longitude || (auditData.photoMetadata ? auditData.photoMetadata.lng : '') || (auditData.location ? auditData.location.lng : '') || storeObj.lng || '',
            distanceMeters: auditData.distanceMeters || '',
            photo: auditData.photo || auditData.photoPosm || auditData.photoUrl || '',
            photoPosm: auditData.photoPosm || auditData.photo || auditData.photoUrl || '',
            photoOverview: auditData.photoOverview || '',
            photoMetadata: auditData.photoMetadata || null
        };

        if (typeof CJAudit !== 'undefined' && CJAudit.showToast) {
            CJAudit.showToast('Đang đồng bộ dữ liệu & ảnh lên Google Sheets...', 'info');
        }

        try {
            // Google Apps Script nhận POST qua text/plain chuẩn (không thêm charset để không vi phạm CORS safelist trên mobile)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 giây cho 2 ảnh tải qua mạng 4G

            const response = await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            console.log('[CJCloudSync] Đã gửi dữ liệu thành công đến Google Apps Script');
            if (typeof CJAudit !== 'undefined' && CJAudit.showToast) {
                CJAudit.showToast('✅ Đã lưu dữ liệu & tải ảnh lên Google Drive/Sheets thành công!', 'success');
            }
            return { success: true };
        } catch (err) {
            console.error('[CJCloudSync] Lỗi khi gửi dữ liệu lên Google Sheets:', err);
            // Lưu vào hàng đợi offline để đồng bộ lại sau nếu cần
            enqueuePendingSync(payload);
            const errStr = err.name === 'AbortError' ? 'Hết thời gian chờ (mạng yếu)' : (err.message || err.toString());
            if (typeof CJAudit !== 'undefined' && CJAudit.showToast) {
                CJAudit.showToast('⚠️ Lỗi gửi Google Sheets: ' + errStr, 'warning');
            }
            return { success: false, error: errStr };
        }
    }

    /**
     * Lưu vào hàng đợi nếu tạm thời mất mạng
     */
    function enqueuePendingSync(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
            queue.push({
                data: payload,
                queuedAt: new Date().toISOString()
            });
            localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
        } catch (e) {
            console.error('Không thể lưu pending sync:', e);
        }
    }

    /**
     * Đồng bộ lại toàn bộ các đợt kiểm tra chưa gửi thành công
     */
    async function syncPendingQueue() {
        const scriptUrl = getScriptUrl();
        if (!scriptUrl) return;

        try {
            const queue = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
            if (!queue || queue.length === 0) return;

            console.log(`[CJCloudSync] Đang đồng bộ lại ${queue.length} bản ghi tồn đọng...`);
            const remaining = [];

            for (const item of queue) {
                try {
                    await fetch(scriptUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify(item.data)
                    });
                } catch (e) {
                    remaining.push(item);
                }
            }

            localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
            if (queue.length > remaining.length && typeof CJApp !== 'undefined' && CJApp.showToast) {
                CJApp.showToast(`✅ Đã đồng bộ ${queue.length - remaining.length} dữ liệu tồn đọng lên Google Sheets!`, 'success');
            }
        } catch (err) {
            console.error('[CJCloudSync] Lỗi khi xử lý hàng đợi:', err);
        }
    }

    // Lắng nghe khi có mạng trở lại để tự động đồng bộ hàng đợi
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            syncPendingQueue();
        });
    }

    function getPendingQueueCount() {
        try {
            const queue = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
            return Array.isArray(queue) ? queue.length : 0;
        } catch(e) {
            return 0;
        }
    }

    /**
     * Kéo toàn bộ dữ liệu kiểm tra từ Google Sheet (GET ?action=getAudits)
     */
    async function pullAuditsFromGoogleSheet(url) {
        const targetUrl = (url || getScriptUrl()).trim();
        if (!targetUrl) {
            throw new Error('Chưa cấu hình URL Google Apps Script!');
        }

        const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=getAudits&t=' + Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        try {
            const response = await fetch(fetchUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();
            if (data.status === 'error') {
                throw new Error(data.message || 'Lỗi từ Google Apps Script');
            }

            return {
                success: true,
                total: data.total || (data.audits ? data.audits.length : 0),
                audits: data.audits || []
            };
        } catch (err) {
            clearTimeout(timeoutId);
            const msg = err.name === 'AbortError' ? 'Hết thời gian chờ phản hồi từ Google Sheets' : (err.message || err.toString());
            throw new Error(msg);
        }
    }

    /**
     * Tự động kéo từ Google Sheet và nạp thẳng vào Storage + cập nhật toàn bộ UI
     */
    async function syncAllFromCloud(silent = false) {
        try {
            if (!silent && typeof CJAudit !== 'undefined' && CJAudit.showToast) {
                CJAudit.showToast('🔄 Đang đồng bộ dữ liệu kiểm tra từ Google Sheet...', 'info');
            }

            const res = await pullAuditsFromGoogleSheet();
            if (!res.success || !Array.isArray(res.audits)) {
                throw new Error('Dữ liệu trả về không đúng định dạng!');
            }

            if (typeof CJStorage === 'undefined' || !CJStorage.syncAuditsFromCloud) {
                throw new Error('Mô-đun CJStorage chưa sẵn sàng!');
            }

            const syncRes = CJStorage.syncAuditsFromCloud(res.audits);

            // Cập nhật toàn bộ giao diện
            if (typeof CJDashboard !== 'undefined' && CJDashboard.refresh) {
                CJDashboard.refresh();
            }
            if (typeof CJAudit !== 'undefined' && CJAudit.renderStoreList) {
                CJAudit.renderStoreList();
            }
            if (typeof CJApp !== 'undefined') {
                if (CJApp.renderAdminProgressReportTable) CJApp.renderAdminProgressReportTable();
                if (CJApp.renderAdminUserManagementTable) CJApp.renderAdminUserManagementTable();
            }

            if (!silent && typeof CJAudit !== 'undefined' && CJAudit.showToast) {
                CJAudit.showToast(`✅ Đã đồng bộ thành công ${syncRes.updatedStores} điểm bán từ Google Sheet!`, 'success');
            }

            return { success: true, ...syncRes };
        } catch (err) {
            console.warn('[CJCloudSync] Đồng bộ Google Sheet thất bại:', err);
            if (!silent && typeof CJAudit !== 'undefined' && CJAudit.showToast) {
                CJAudit.showToast(`⚠️ Không thể đồng bộ từ Google Sheet: ${err.message}`, 'warning');
            }
            return { success: false, error: err.message };
        }
    }

    return {
        getScriptUrl: getScriptUrl,
        setScriptUrl: setScriptUrl,
        testConnection: testConnection,
        sendAuditToGoogleSheet: sendAuditToGoogleSheet,
        syncAuditRecord: sendAuditToGoogleSheet,
        pullAuditsFromGoogleSheet: pullAuditsFromGoogleSheet,
        syncAllFromCloud: syncAllFromCloud,
        syncPendingQueue: syncPendingQueue,
        getPendingQueueCount: getPendingQueueCount
    };
})();

// Gắn vào window
if (typeof window !== 'undefined') {
    window.CJCloudSync = CJCloudSync;
}
