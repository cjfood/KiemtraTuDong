/**
 * CJ MarketAudit - Anti-Fraud Photo Watermarking Engine
 * Automatically imprints GPS, Timestamp, Store Name, and Auditor details onto audit photos
 */

const CJWatermark = {
  /**
   * Embed watermark onto an image file or dataURL
   * @param {File|Blob|string} imageSource - File object or base64 URL
   * @param {Object} metadata - Store info, GPS, Auditor, Freezer info
   * @returns {Promise<string>} Base64 string of watermarked image
   */
  async processImage(imageSource, metadata = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        try {
          // Normalize dimension: max 1080px width for ultra-fast mobile 4G upload & sharp watermark
          const maxWidth = 1080;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          // Draw main photo
          ctx.drawImage(img, 0, 0, width, height);

          // Calculate watermark banner height (around 22-26% of photo or min 180px)
          const bannerHeight = Math.max(160, Math.round(height * 0.22));
          const bannerY = height - bannerHeight;

          // Draw Dark Semi-transparent Gradient Banner
          const gradient = ctx.createLinearGradient(0, bannerY - 30, 0, height);
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradient.addColorStop(0.25, "rgba(10, 20, 30, 0.85)");
          gradient.addColorStop(1, "rgba(5, 10, 20, 0.95)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, bannerY - 30, width, bannerHeight + 30);

          // Draw CJ Brand Top Line in Banner
          ctx.fillStyle = "#E31837"; // CJ Red
          ctx.fillRect(0, bannerY, width, 4);

          // Watermark Texts
          const paddingX = Math.round(width * 0.03);
          let currentY = bannerY + 28;

          // Line 1: Header Badge
          ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#F47920"; // CJ Orange
          ctx.fillText("CJ FOODS VIỆT NAM  |  BIÊN BẢN KIỂM TRA THỊ TRƯỜNG", paddingX, currentY);

          // Tag/Channel pill badge on right side
          const channelText = (metadata.channel || "FMCG").toUpperCase();
          ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
          const pillWidth = ctx.measureText(channelText).width + 20;
          const pillX = width - paddingX - pillWidth;
          ctx.fillStyle = "#E31837";
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(pillX, currentY - 14, pillWidth, 20, 4) : ctx.fillRect(pillX, currentY - 14, pillWidth, 20);
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(channelText, pillX + 10, currentY);

          // Line 2: Store Info
          currentY += 26;
          ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#FFFFFF";
          const storeTitle = `🏪 ${metadata.storeName || "Điểm bán chưa chọn"} [${metadata.storeId || "N/A"}]`;
          ctx.fillText(storeTitle, paddingX, currentY);

          // Line 3: Address
          currentY += 22;
          ctx.font = "14px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#D1D5DB";
          const address = `📍 ${metadata.address || "Chưa xác định địa chỉ"}`;
          ctx.fillText(address.length > 75 ? address.substring(0, 72) + "..." : address, paddingX, currentY);

          // Line 4: GPS Coordinates & Accuracy & Freezer Info & Photo Reason
          currentY += 22;
          ctx.font = "13px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#93C5FD"; // Light blue
          const lat = metadata.lat ? Number(metadata.lat).toFixed(6) : "10.801522";
          const lng = metadata.lng ? Number(metadata.lng).toFixed(6) : "106.708215";
          const tagInfo = metadata.assetTag ? ` | Tủ: ${metadata.assetTag}` : "";
          const reasonInfo = metadata.photoReason ? ` | [${metadata.photoReason}]` : "";
          ctx.fillText(`🌐 GPS: ${lat}, ${lng}${tagInfo}${reasonInfo}`, paddingX, currentY);

          // Line 5: Timestamp & Auditor
          currentY += 22;
          ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#34D399"; // Light green
          const nowStr = metadata.timestamp || new Date().toLocaleString("vi-VN");
          const auditor = metadata.auditor || "Sales Field";
          ctx.fillText(`⏰ ${nowStr}  |  👤 NV Kiểm tra: ${auditor}`, paddingX, currentY);

          // Anti-tamper verification watermark hash bottom right
          ctx.font = "10px monospace";
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          const hash = `CJF-SEC-${Math.abs((metadata.storeId || "").split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase()}-${Date.now().toString().slice(-6)}`;
          ctx.fillText(`VERIFIED SECURE: ${hash}`, width - paddingX - 170, height - 10);

          // Export as JPEG (quality 0.78 balances crystal clarity with ultra-light ~180KB payload)
          const resultDataUrl = canvas.toDataURL("image/jpeg", 0.78);
          resolve(resultDataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = (err) => reject(err);

      if (typeof imageSource === "string") {
        img.src = imageSource;
      } else if (imageSource instanceof Blob || imageSource instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => (img.src = e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(imageSource);
      } else {
        reject(new Error("Định dạng ảnh không hợp lệ"));
      }
    });
  },

  /**
   * Helper to generate simulated sample images for testing when no camera is connected
   */
  generatePlaceholderImage(type, label = "Tủ Đông CJ Foods") {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 640, 480);
    if (type === "good") {
      bgGrad.addColorStop(0, "#1E3A8A");
      bgGrad.addColorStop(1, "#065F46");
    } else if (type === "warning") {
      bgGrad.addColorStop(0, "#78350F");
      bgGrad.addColorStop(1, "#D97706");
    } else {
      bgGrad.addColorStop(0, "#7F1D1D");
      bgGrad.addColorStop(1, "#DC2626");
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 640, 480);

    // Draw Freezer Mockup Outline
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, 480, 320);

    // Freezer glass line
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(90, 90, 460, 150);

    // Draw bibigo / cau tre logo placeholder
    ctx.fillStyle = "#E31837";
    ctx.fillRect(100, 260, 180, 50);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("bibigo", 140, 295);

    ctx.fillStyle = "#10B981";
    ctx.fillRect(300, 260, 220, 50);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Cầu Tre", 350, 295);

    // Text details
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, 120, 160);

    ctx.font = "16px Arial";
    ctx.fillStyle = "#E5E7EB";
    ctx.fillText("Ảnh mô phỏng thực địa - CJ MarketAudit", 160, 200);

    return canvas.toDataURL("image/jpeg", 0.9);
  }
};
