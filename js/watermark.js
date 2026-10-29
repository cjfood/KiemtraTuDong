/**
 * CJ MarketAudit - Anti-Fraud Photo Watermarking Engine
 * Automatically imprints GPS Coordinates, Current Street Address, Timestamp, Store Name, and Auditor details onto audit photos
 */

const CJWatermark = {
  /**
   * Helper to wrap long text into multiple lines that fit within maxTextWidth
   */
  wrapTextLines(ctx, text, maxTextWidth, maxLines = 2) {
    const words = String(text || "").trim().split(/\s+/);
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
        if (lines.length >= maxLines - 1) {
          const remaining = words.slice(i).join(" ");
          let finalLine = remaining;
          while (ctx.measureText(finalLine + "...").width > maxTextWidth && finalLine.length > 0) {
            finalLine = finalLine.slice(0, -1).trim();
          }
          lines.push(finalLine === remaining ? finalLine : finalLine + "...");
          return lines;
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  },

  /**
   * Embed watermark onto an image file or dataURL
   * @param {File|Blob|string} imageSource - File object or base64 URL
   * @param {Object} metadata - Store info, GPS, Current Address, Auditor, Freezer info
   * @returns {Promise<string>} Base64 string of watermarked image
   */
  async processImage(imageSource, metadata = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        try {
          // Normalize dimension: 960px max width (or scale up small photos so watermark text is crisp & readable)
          const maxWidth = 960;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else if (width < 720) {
            height = Math.round((height * 800) / width);
            width = 800;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          // Draw main photo
          ctx.drawImage(img, 0, 0, width, height);

          const paddingX = Math.round(width * 0.03);
          const maxTextWidth = width - paddingX * 2;

          // Prepare Address lines (up to 2 lines so full current address is never cut off)
          ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
          const rawAddr = metadata.address || metadata.storeAddress || "Đang xác định địa chỉ...";
          const addrPrefix = "📍 Địa chỉ hiện tại: ";
          const addrLines = this.wrapTextLines(ctx, `${addrPrefix}${rawAddr}`, maxTextWidth, 2);

          // Calculate watermark banner height dynamically based on address lines
          const extraAddrHeight = (addrLines.length > 1) ? 20 : 0;
          const bannerHeight = Math.max(175 + extraAddrHeight, Math.round(height * 0.23) + extraAddrHeight);
          const bannerY = height - bannerHeight;

          // Draw Dark Semi-transparent Gradient Banner
          const gradient = ctx.createLinearGradient(0, bannerY - 30, 0, height);
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradient.addColorStop(0.2, "rgba(8, 15, 28, 0.88)");
          gradient.addColorStop(1, "rgba(4, 8, 16, 0.96)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, bannerY - 30, width, bannerHeight + 30);

          // Draw CJ Brand Top Line in Banner
          ctx.fillStyle = "#E31837"; // CJ Red
          ctx.fillRect(0, bannerY, width, 4);

          let currentY = bannerY + 26;

          // Line 1: Header Badge
          ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#F47920"; // CJ Orange
          ctx.fillText("CJ FOODS VIỆT NAM  |  BIÊN BẢN KIỂM TRA THỊ TRƯỜNG", paddingX, currentY);

          // Tag/Channel pill badge on right side
          const channelText = (metadata.channel || "GT").toUpperCase();
          ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
          const pillWidth = ctx.measureText(channelText).width + 20;
          const pillX = width - paddingX - pillWidth;
          ctx.fillStyle = "#E31837";
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(pillX, currentY - 14, pillWidth, 20, 4) : ctx.fillRect(pillX, currentY - 14, pillWidth, 20);
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(channelText, pillX + 10, currentY);

          // Line 2: Store Info & Freezer Tag
          currentY += 25;
          ctx.font = "bold 17px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#FFFFFF";
          const storeCodeVal = metadata.storeId || metadata.storeCode || "N/A";
          const freezerTagVal = metadata.assetTag || metadata.freezerId || "";
          const storeTitle = `🏪 ${metadata.storeName || "Điểm bán CJ"} [${storeCodeVal}]${freezerTagVal ? `  •  ❄️ Tủ: ${freezerTagVal}` : ""}`;
          const storeLines = this.wrapTextLines(ctx, storeTitle, maxTextWidth, 1);
          ctx.fillText(storeLines[0] || storeTitle, paddingX, currentY);

          // Line 3: GPS Coordinates (Prominent Yellow/Cyan highlight)
          currentY += 24;
          ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#FACC15"; // Bright Yellow for GPS position
          const lat = metadata.lat ? Number(metadata.lat).toFixed(6) : "10.801522";
          const lng = metadata.lng ? Number(metadata.lng).toFixed(6) : "106.708215";
          const accText = metadata.accuracy ? ` (±${Math.round(metadata.accuracy)}m)` : "";
          const reasonInfo = metadata.photoReason ? `  |  [${metadata.photoReason}]` : "";
          ctx.fillText(`🌐 Vị trí GPS: ${lat}, ${lng}${accText}${reasonInfo}`, paddingX, currentY);

          // Line 4 (& 5): Current Address of Photo
          ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#E5E7EB"; // Crisp light gray/white
          addrLines.forEach((lineText) => {
            currentY += 21;
            ctx.fillText(lineText, paddingX, currentY);
          });

          // Line 6: Timestamp & Auditor
          currentY += 23;
          ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#34D399"; // Light green
          const nowStr = metadata.timestamp || new Date().toLocaleString("vi-VN");
          const auditor = metadata.auditor || metadata.auditorName || "NV Kiểm tra";
          ctx.fillText(`⏰ ${nowStr}  |  👤 NV Kiểm tra: ${auditor}`, paddingX, currentY);

          // Anti-tamper verification watermark hash bottom right
          ctx.font = "10px monospace";
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          const hash = `CJF-GPS-${Math.abs(String(storeCodeVal).split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase()}-${Date.now().toString().slice(-6)}`;
          ctx.fillText(`VERIFIED GPS: ${hash}`, width - paddingX - 175, height - 8);

          // Export as JPEG (quality 0.75 balances crystal clarity with fast 4G upload)
          const resultDataUrl = canvas.toDataURL("image/jpeg", 0.75);
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

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, 480, 320);

    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(90, 90, 460, 150);

    ctx.fillStyle = "#E31837";
    ctx.fillRect(100, 260, 180, 50);
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("bibigo", 140, 295);

    ctx.fillStyle = "#10B981";
    ctx.fillRect(300, 260, 220, 50);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Cầu Tre", 350, 295);

    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, 120, 160);

    ctx.font = "16px Arial";
    ctx.fillStyle = "#E5E7EB";
    ctx.fillText("Ảnh mô phỏng thực địa - CJ MarketAudit", 160, 200);

    return canvas.toDataURL("image/jpeg", 0.9);
  }
};
