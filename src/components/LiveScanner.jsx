import React, { useState, useEffect, useRef } from 'react';
import { Camera, SwitchCamera, Zap, ZapOff, ZoomIn, ZoomOut, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { decodeQRCodeFromCanvas } from '../utils/qrDecoder';

export default function LiveScanner({ onScanSuccess }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Play beep sound on scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  // Enumerate available video inputs
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoInputs);
        if (videoInputs.length > 0 && !selectedCameraId) {
          // Prefer back camera if available
          const backCam = videoInputs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          setSelectedCameraId(backCam ? backCam.deviceId : videoInputs[0].deviceId);
        }
      } catch (err) {
        console.error('Error enumerating cameras:', err);
      }
    }
    getDevices();
  }, []);

  // Start video stream
  useEffect(() => {
    let active = true;

    async function startStream() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      setErrorMsg('');
      try {
        const constraints = {
          video: selectedCameraId
            ? { deviceId: { exact: selectedCameraId } }
            : { facingMode: 'environment' }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        // Check Torch & Zoom capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
          setTorchOn(false);
        }

        if (capabilities.zoom) {
          setZoomCapabilities(capabilities.zoom);
        } else {
          setZoomCapabilities(null);
        }

      } catch (err) {
        console.error('Camera access error:', err);
        setErrorMsg('Unable to access camera. Please check camera permissions in your browser.');
      }
    }

    startStream();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [selectedCameraId]);

  // Scanning Loop
  useEffect(() => {
    let lastScanTime = 0;

    const scanFrame = async () => {
      const now = performance.now();
      if (isScanning && videoRef.current && videoRef.current.readyState >= 2 && (now - lastScanTime > 150)) {
        lastScanTime = now;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const result = await decodeQRCodeFromCanvas(canvas);
          if (result && result.rawValue) {
            playBeep();
            if (navigator.vibrate) navigator.vibrate(80);
            onScanSuccess({
              rawValue: result.rawValue,
              format: result.format,
              method: 'Live Camera',
              thumbnail: canvas.toDataURL('image/jpeg', 0.5)
            });
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isScanning, onScanSuccess]);

  // Torch Toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next }]
      });
      setTorchOn(next);
    } catch (e) {
      console.error('Torch error:', e);
    }
  };

  // Zoom slider change
  const handleZoomChange = async (e) => {
    const val = parseFloat(e.target.value);
    setZoomLevel(val);
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ zoom: val }]
      });
    } catch (e) {
      console.error('Zoom error:', e);
    }
  };

  // Switch camera
  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex(c => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].deviceId);
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px 80px 16px' }}>
      <div className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '6px' }}>
              <Sparkles size={12} /> Live Optical Recognition
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Camera QR Scanner</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasTorch && (
              <button 
                className={`btn-ghost ${torchOn ? 'active' : ''}`}
                onClick={toggleTorch}
                title="Toggle Torch / Flash"
                style={{ background: torchOn ? 'rgba(245, 158, 11, 0.2)' : undefined, color: torchOn ? '#fbbf24' : undefined }}
              >
                {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
              </button>
            )}

            {cameras.length > 1 && (
              <button className="btn-ghost" onClick={switchCamera} title="Switch Front/Back Lens">
                <SwitchCamera size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Video Viewport Container */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          background: '#000',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {errorMsg ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--danger)' }}>
              <AlertCircle size={44} style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 600 }}>{errorMsg}</p>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                muted
              />

              {/* Scanning Target Box & Laser Line */}
              <div style={{
                position: 'absolute',
                width: '68%',
                aspectRatio: '1/1',
                maxHeight: '75%',
                border: '2px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.45)',
                pointerEvents: 'none'
              }}>
                {/* Corner Markers */}
                <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '28px', height: '28px', borderTop: '4px solid #6366f1', borderLeft: '4px solid #6366f1', borderTopLeftRadius: '24px' }} />
                <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '28px', height: '28px', borderTop: '4px solid #6366f1', borderRight: '4px solid #6366f1', borderTopRightRadius: '24px' }} />
                <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '28px', height: '28px', borderBottom: '4px solid #6366f1', borderLeft: '4px solid #6366f1', borderBottomLeftRadius: '24px' }} />
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '28px', height: '28px', borderBottom: '4px solid #6366f1', borderRight: '4px solid #6366f1', borderBottomRightRadius: '24px' }} />

                {/* Laser Animation */}
                <div className="animate-laser" />
              </div>
            </>
          )}

          {/* Hidden Canvas for Decoding */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Bottom Controls (Zoom Slider & Status) */}
        {zoomCapabilities && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '18px' }}>
            <ZoomOut size={16} color="var(--text-muted)" />
            <input 
              type="range" 
              min={zoomCapabilities.min || 1} 
              max={zoomCapabilities.max || 5} 
              step={zoomCapabilities.step || 0.1}
              value={zoomLevel}
              onChange={handleZoomChange}
              style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
            />
            <ZoomIn size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '35px' }}>
              {zoomLevel.toFixed(1)}x
            </span>
          </div>
        )}

        <div style={{ marginTop: '18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Align QR code inside the target frame. Detection is automatic and instantaneous.
        </div>

      </div>
    </div>
  );
}
