import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCanvas({ 
  value, 
  size = 280, 
  gradient, 
  bgColor = '#ffffff', 
  dotsStyle = 'rounded',
  cornersStyle = 'extra-rounded',
  centerIconType = 'pdf',
  showCenterIcon = true
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scale for ultra-crisp display and printing
    const scale = 3;
    canvas.width = size * scale;
    canvas.height = size * scale;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    let qrData = null;
    try {
      qrData = QRCode.create(value, { errorCorrectionLevel: 'H' });
    } catch (err) {
      try {
        // Fallback to medium error correction if data is moderately long
        qrData = QRCode.create(value, { errorCorrectionLevel: 'M' });
      } catch (err2) {
        console.error('QR creation error:', err2);
        return;
      }
    }

    if (!qrData) return;

    const moduleCount = qrData.modules.size;
    const margin = 2; // quiet zone in module count
    const totalModules = moduleCount + margin * 2;
    const cellSize = (size * scale) / totalModules;

    // Clear and fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Prepare Gradient Brush
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, gradient?.color1 || '#6366f1');
    grad.addColorStop(1, gradient?.color2 || '#a855f7');
    ctx.fillStyle = grad;

    // Draw QR Modules
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        const isDark = qrData.modules.get(r, c);
        if (!isDark) continue;

        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;

        // Check if inside corner locator squares
        const isCorner = 
          (r < 7 && c < 7) || 
          (r < 7 && c >= moduleCount - 7) || 
          (r >= moduleCount - 7 && c < 7);

        // Check if in center (reserve area for badge)
        const centerStart = Math.floor(moduleCount / 2) - 3;
        const centerEnd = Math.floor(moduleCount / 2) + 3;
        const isCenter = showCenterIcon && (r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd);

        if (isCenter) continue;

        if (isCorner) {
          ctx.beginPath();
          if (cornersStyle === 'extra-rounded') {
            ctx.roundRect(x, y, cellSize + 0.2, cellSize + 0.2, cellSize * 0.4);
          } else if (cornersStyle === 'dot') {
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2, 0, Math.PI * 2);
          } else {
            ctx.rect(x, y, cellSize + 0.2, cellSize + 0.2);
          }
          ctx.fill();
        } else {
          ctx.beginPath();
          if (dotsStyle === 'rounded' || dotsStyle === 'classy-rounded') {
            ctx.roundRect(x, y, cellSize + 0.2, cellSize + 0.2, cellSize * 0.35);
          } else if (dotsStyle === 'dots') {
            ctx.arc(x + cellSize / 2, y + cellSize / 2, (cellSize / 2) * 0.85, 0, Math.PI * 2);
          } else {
            ctx.rect(x, y, cellSize + 0.2, cellSize + 0.2);
          }
          ctx.fill();
        }
      }
    }

    // 2. Draw Center Badge / Icon if enabled
    if (showCenterIcon) {
      const centerBoxSize = cellSize * 7;
      const centerX = (canvas.width - centerBoxSize) / 2;
      const centerY = (canvas.height - centerBoxSize) / 2;

      // Outer badge background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(centerX - 2, centerY - 2, centerBoxSize + 4, centerBoxSize + 4, centerBoxSize * 0.28);
      ctx.fill();

      // Badge fill with soft border
      ctx.fillStyle = gradient?.color1 || '#6366f1';
      ctx.beginPath();
      ctx.roundRect(centerX + 4, centerY + 4, centerBoxSize - 8, centerBoxSize - 8, centerBoxSize * 0.24);
      ctx.fill();

      // Icon Text Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(centerBoxSize * 0.28)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (centerIconType || 'DOC').toUpperCase().slice(0, 4);
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }

  }, [value, size, gradient, bgColor, dotsStyle, cornersStyle, centerIconType, showCenterIcon]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        display: 'block', 
        margin: '0 auto', 
        borderRadius: '8px', 
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)' 
      }} 
    />
  );
}
