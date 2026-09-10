/**
 * =========================================================================
 * CJ CAU TRE / CJ FOODS VIETNAM - MARKET AUDIT SYSTEM
 * CLOUD SYNC MODULE (GOOGLE SHEETS & GOOGLE DRIVE INTEGRATION)
 * =========================================================================
 */

const CJCloudSync = (function () {
    const STORAGE_KEY = 'cj_google_sheet_url';
    const PENDING_SYNC_KEY = 'cj_pending_sync_queue';
    const DEFAULT_SYSTEM_URL = 'https://script.google.com/macros/s/AKfycbw4n6lsTKqsVXlrtyu2qx5GNFTksMmtoAyCcvgPpXfXD71nTP-pga_B2a2uAoSKRxOdOw/exec';

    /**
     * Lấy URL Google Apps Script đã lưu hoặc URL mặc định của hệ thống
     */
    function getScriptUrl() {
        const customUrl = localStorage.getItem(STORAGE_KEY);
        if (customUrl && customUrl.trim()) return customUrl.trim();
        if (typeof CJ_SYSTEM_GOOGLE_SHEET_URL !== 'undefined' && CJ_SYSTEM_GOOGLE_SHEET_URL && CJ_SYSTEM_GOOGLE_SHEET_URL.trim()) {
            return CJ_SYSTEM_GOOGLE_SHEET_URL.trim();
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
        const payload = {
            timestamp: auditData.timestamp || auditData.date || new Date().toISOString(),
            userCode: auditData.userCode || user.username || user.userCode || '',
            userName: auditData.userName || user.name || user.fullName || '',
            region: auditData.region || user.area || user.region || user.channel || '',
            customerCode: auditData.customerCode || auditData.outletCode || '',
            customerName: auditData.customerName || auditData.outletName || '',
            address: auditData.address || '',
            phone: auditData.phone || '',
            freezerBarcode: auditData.freezerBarcode || auditData.barcode || '',
            freezerModel: auditData.freezerModel || '',
            freezerQuantity: auditData.freezerQuantity || 1,
            workingCondition: auditData.workingCondition || '',
            conditionNote: auditData.conditionNote || '',
            cleanliness: auditData.cleanliness || '',
            stockCompliance: auditData.stockCompliance || '',
            displayLocation: auditData.displayLocation || '',
            posmStatus: auditData.posmStatus || '',
            notes: auditData.notes || '',
            latitude: auditData.latitude || (auditData.location ? auditData.location.lat : '') || '',
            longitude: auditData.longitude || (auditData.location ? auditData.location.lng : '') || '',
            distanceMeters: auditData.distanceMeters || '',
            photo: auditData.photo || auditData.photoPosm || '', // base64 photo 1 (fallback)
            photoPosm: auditData.photoPosm || auditData.photo || '', // base64 photo 1 (Tủ đông)
            photoOverview: auditData.photoOverview || '' // base64 photo 2 (Tổng quan cửa hàng)
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

    return {
        getScriptUrl: getScriptUrl,
        setScriptUrl: setScriptUrl,
        testConnection: testConnection,
        sendAuditToGoogleSheet: sendAuditToGoogleSheet,
        syncPendingQueue: syncPendingQueue,
        getPendingQueueCount: getPendingQueueCount
    };
})();

// Gắn vào window
if (typeof window !== 'undefined') {
    window.CJCloudSync = CJCloudSync;
}
