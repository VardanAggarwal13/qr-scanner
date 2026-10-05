import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Image as ImageIcon, Video, Clipboard, 
  Sparkles, CheckCircle2, AlertCircle, RefreshCw, FileSearch, ArrowRight
} from 'lucide-react';
import { decodeQRCodeFromFile, decodeQRCodeFromCanvas } from '../utils/qrDecoder';
import { scanPDFForQRCodes } from '../utils/pdfScanner';

export default function MediaScanner({ onScanSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [pdfResults, setPdfResults] = useState(null);
  const [videoScanResults, setVideoScanResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);

  // Global Clipboard (Ctrl+V) listener
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleProcessFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Process File Dispatcher
  const handleProcessFile = async (file) => {
    if (!file) return;
    setErrorMessage('');
    setIsProcessing(true);
    setPdfResults(null);
    setVideoScanResults(null);

    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    try {
      if (isPDF) {
        setProcessingStatus('Analyzing document pages with PDF engine...');
        const result = await scanPDFForQRCodes(file, (curr, total) => {
          setProcessingStatus(`Scanning PDF page ${curr} of ${total}...`);
        });

        if (result.detectedCodes.length === 0) {
          setErrorMessage(`Scanned all ${result.totalPages} pages of the PDF, but found no QR codes.`);
        } else {
          setPdfResults(result);
          // If only 1 QR code found, trigger scan success automatically
          if (result.detectedCodes.length === 1) {
            onScanSuccess({
              rawValue: result.detectedCodes[0].rawValue,
              format: result.detectedCodes[0].format,
              method: `PDF Document (Page ${result.detectedCodes[0].page})`,
              thumbnail: result.detectedCodes[0].thumbnail
            });
          }
        }
      } else if (isVideo) {
        setProcessingStatus('Sampling video frames for QR codes...');
        await scanVideoFile(file);
      } else {
        setProcessingStatus('Decoding image payload...');
        const result = await decodeQRCodeFromFile(file);
        if (result && result.rawValue) {
          onScanSuccess({
            rawValue: result.rawValue,
            format: result.format,
            method: 'Uploaded Image',
            thumbnail: result.thumbnail
          });
        } else {
          setErrorMessage('No readable QR code found in this image. Ensure the image is clear and well-lit.');
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
      setErrorMessage(`Failed to process file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Video Frame Scanner
  const scanVideoFile = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = async () => {
        const duration = video.duration;
        const canvas = document.createElement('canvas');
        const detected = [];

        // Sample 2 frames per second
        const step = 0.5;
        for (let time = 0; time < duration; time += step) {
          video.currentTime = time;
          await new Promise(r => { video.onseeked = r; });

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const result = await decodeQRCodeFromCanvas(canvas);
          if (result && !detected.find(d => d.rawValue === result.rawValue)) {
            detected.push({
              time: time.toFixed(1),
              rawValue: result.rawValue,
              format: result.format,
              thumbnail: canvas.toDataURL('image/jpeg', 0.5)
            });
          }
        }

        if (detected.length > 0) {
          setVideoScanResults(detected);
          if (detected.length === 1) {
            onScanSuccess({
              rawValue: detected[0].rawValue,
              format: detected[0].format,
              method: `Video Timestamp (${detected[0].time}s)`,
              thumbnail: detected[0].thumbnail
            });
          }
        } else {
          setErrorMessage('Scanned video timeline, but found no QR codes.');
        }

        URL.revokeObjectURL(video.src);
        resolve();
      };

      video.onerror = () => {
        setErrorMessage('Could not load video file.');
        resolve();
      };
    });
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 16px 80px 16px' }}>
      <div className="glass-panel" style={{ padding: '30px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="badge badge-primary" style={{ marginBottom: '8px' }}>
            <FileSearch size={13} /> Deep Multi-Format Decoder
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
            Scan Images, Multi-Page PDFs & Videos
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Upload any graphic, multi-page invoice/document, or video clip — or press <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>Ctrl + V</kbd> to paste a screenshot!
          </p>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) {
              handleProcessFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-glass-bright)',
            background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'rgba(15, 23, 42, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '44px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: isDragging ? '0 0 30px rgba(99, 102, 241, 0.3)' : 'none'
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }}
            accept="image/*,.pdf,application/pdf,video/*"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleProcessFile(e.target.files[0]);
              }
            }}
          />

          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: 'var(--accent-primary)'
          }}>
            {isProcessing ? <RefreshCw className="animate-spin" size={28} /> : <Upload size={28} />}
          </div>

          {isProcessing ? (
            <div>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                {processingStatus || 'Analyzing Media Content...'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Please wait while frames & pages are decoded...
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>
                Drop files here or click to browse
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '8px' }}>
                <span><ImageIcon size={14} style={{ verticalAlign: 'middle' }} /> JPG, PNG, WEBP</span>
                <span>•</span>
                <span><FileText size={14} style={{ verticalAlign: 'middle' }} /> Multi-page PDF</span>
                <span>•</span>
                <span><Video size={14} style={{ verticalAlign: 'middle' }} /> MP4, WEBM</span>
                <span>•</span>
                <span><Clipboard size={14} style={{ verticalAlign: 'middle' }} /> Paste (Ctrl+V)</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={{
            marginTop: '20px',
            padding: '14px 18px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={20} />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Multi-Page PDF Scan Results Grid */}
        {pdfResults && (
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                Detected {pdfResults.detectedCodes.length} QR Code{pdfResults.detectedCodes.length > 1 ? 's' : ''} in Document ({pdfResults.totalPages} Total Pages)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {pdfResults.detectedCodes.map((item, idx) => (
                <div 
                  key={idx}
                  className="glass-card"
                  onClick={() => onScanSuccess({
                    rawValue: item.rawValue,
                    format: item.format,
                    method: `PDF Document (Page ${item.page})`,
                    thumbnail: item.thumbnail
                  })}
                  style={{ padding: '14px', cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative', height: '140px', background: '#000', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '10px' }}>
                    <img 
                      src={item.thumbnail} 
                      alt={`Page ${item.page}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <span className="badge badge-primary" style={{ position: 'absolute', top: '8px', left: '8px' }}>
                      Page {item.page}
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '8px'
                  }}>
                    {item.rawValue}
                  </p>

                  <button className="btn-secondary" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}>
                    Inspect Code <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Scan Results Grid */}
        {videoScanResults && (
          <div style={{ marginTop: '28px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '14px' }}>
              Detected {videoScanResults.length} QR Codes in Video Timeline
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {videoScanResults.map((item, idx) => (
                <div 
                  key={idx}
                  className="glass-card"
                  onClick={() => onScanSuccess({
                    rawValue: item.rawValue,
                    format: item.format,
                    method: `Video Timestamp (${item.time}s)`,
                    thumbnail: item.thumbnail
                  })}
                  style={{ padding: '14px', cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative', height: '120px', background: '#000', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '10px' }}>
                    <img src={item.thumbnail} alt={`At ${item.time}s`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <span className="badge badge-success" style={{ position: 'absolute', top: '8px', left: '8px' }}>
                      At {item.time}s
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px' }}>
                    {item.rawValue}
                  </p>

                  <button className="btn-secondary" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}>
                    Inspect Code <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
