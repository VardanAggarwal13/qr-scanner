import jsQR from 'jsqr';

/**
 * Decodes QR code from an HTML canvas, image element, or ImageData using BarcodeDetector or jsQR.
 * Applies enhancement passes (contrast, inversion) if the initial pass fails.
 */
export async function decodeQRCodeFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return null;

  // 1. Try Native BarcodeDetector API (fast, hardware-accelerated)
  if ('BarcodeDetector' in window) {
    try {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'data_matrix', 'code_128', 'ean_13'] });
      const barcodes = await barcodeDetector.detect(canvas);
      if (barcodes && barcodes.length > 0) {
        return {
          rawValue: barcodes[0].rawValue,
          format: barcodes[0].format || 'qr_code',
          cornerPoints: barcodes[0].cornerPoints || null,
          method: 'BarcodeDetector'
        };
      }
    } catch (e) {
      // Fallback silently to jsQR
    }
  }

  // 2. jsQR Standard Pass
  const imageData = ctx.getImageData(0, 0, width, height);
  let code = jsQR(imageData.data, width, height, {
    inversionAttempts: 'attemptBoth'
  });

  if (code) {
    return {
      rawValue: code.data,
      format: 'qr_code',
      location: code.location,
      method: 'jsQR-standard'
    };
  }

  // 3. Fallback Enhancement Pass (High Contrast & Grayscale for blurry or low-light images)
  const enhancedData = enhanceImageData(imageData);
  code = jsQR(enhancedData.data, width, height, {
    inversionAttempts: 'attemptBoth'
  });

  if (code) {
    return {
      rawValue: code.data,
      format: 'qr_code',
      location: code.location,
      method: 'jsQR-enhanced'
    };
  }

  return null;
}

/**
 * Decodes QR code from an Image file (Blob/File)
 */
export async function decodeQRCodeFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          // Scale down if image is massive (e.g. 4000x3000) for performance while retaining readability
          const maxDim = 1600;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);

          const result = await decodeQRCodeFromCanvas(canvas);
          resolve(result ? { ...result, thumbnail: canvas.toDataURL('image/jpeg', 0.6) } : null);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Applies contrast stretch and binarization hint for tricky codes
 */
function enhanceImageData(originalImageData) {
  const data = new Uint8ClampedArray(originalImageData.data);
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    // Luminance
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // High contrast thresholding
    const contrastVal = gray > 128 ? Math.min(255, gray * 1.25) : Math.max(0, gray * 0.75);
    data[i] = contrastVal;
    data[i + 1] = contrastVal;
    data[i + 2] = contrastVal;
  }

  return new ImageData(data, originalImageData.width, originalImageData.height);
}
