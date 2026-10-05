import React, { useState } from 'react';
import { 
  X, ExternalLink, Copy, CheckCircle2, Share2, Wifi, User, 
  CreditCard, MapPin, Mail, Phone, MessageSquare, FileText, Eye, Download
} from 'lucide-react';
import { parseQRContent } from '../utils/contentParser';

export default function ScanResultModal({ scanResult, onClose, onOpenDocument }) {
  const [copied, setCopied] = useState(false);

  if (!scanResult) return null;

  const parsed = parseQRContent(scanResult.rawValue);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text || scanResult.rawValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: parsed.title,
          text: scanResult.rawValue,
          url: parsed.type === 'url' ? parsed.url : undefined
        });
      } catch (e) {}
    } else {
      handleCopy();
    }
  };

  const getTypeIcon = () => {
    switch (parsed.type) {
      case 'attached_media': return <FileText size={26} color="var(--accent-primary)" />;
      case 'url': return <ExternalLink size={26} color="#06b6d4" />;
      case 'wifi': return <Wifi size={26} color="#10b981" />;
      case 'vcard': return <User size={26} color="#a855f7" />;
      case 'upi': return <CreditCard size={26} color="#f59e0b" />;
      case 'geo': return <MapPin size={26} color="#ef4444" />;
      case 'email': return <Mail size={26} color="#3b82f6" />;
      case 'phone': return <Phone size={26} color="#10b981" />;
      case 'sms': return <MessageSquare size={26} color="#06b6d4" />;
      default: return <FileText size={26} color="#818cf8" />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '560px',
        width: '100%',
        padding: '28px',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Close Button */}
        <button 
          className="btn-ghost" 
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', padding: '6px' }}
        >
          <X size={20} />
        </button>

        {/* Header with Type Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getTypeIcon()}
          </div>
          <div>
            <span className="badge badge-primary" style={{ marginBottom: '4px' }}>
              {parsed.type.toUpperCase().replace('_', ' ')} DETECTED
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {parsed.title}
            </h2>
          </div>
        </div>

        {/* Thumbnail if present */}
        {scanResult.thumbnail && (
          <div style={{
            maxHeight: '160px',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: '#000',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src={scanResult.thumbnail} 
              alt="Scan capture" 
              style={{ maxHeight: '160px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Content Box */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '22px',
          maxHeight: '180px',
          overflowY: 'auto'
        }}>
          <p style={{
            fontSize: '0.9rem',
            lineHeight: 1.6,
            wordBreak: 'break-word',
            fontFamily: parsed.type === 'url' || parsed.type === 'wifi' ? 'var(--font-mono)' : 'inherit'
          }}>
            {parsed.details || scanResult.rawValue}
          </p>
        </div>

        {/* Contextual Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* 1. Attached Media Action */}
          {parsed.type === 'attached_media' && (
            <button 
              className="btn-primary" 
              onClick={() => {
                onClose();
                if (onOpenDocument) onOpenDocument(parsed.mediaData);
              }}
              style={{ width: '100%' }}
            >
              <Eye size={18} /> View Attached Document / Media
            </button>
          )}

          {/* 2. Web URL Action */}
          {parsed.type === 'url' && (
            <a 
              href={parsed.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ width: '100%', textDecoration: 'none' }}
            >
              <ExternalLink size={18} /> Open in Browser
            </a>
          )}

          {/* 3. Wi-Fi Action */}
          {parsed.type === 'wifi' && (
            <button 
              className="btn-primary"
              onClick={() => handleCopy(parsed.password)}
              style={{ width: '100%' }}
            >
              <Copy size={18} /> Copy Wi-Fi Password ({parsed.password})
            </button>
          )}

          {/* 4. Contact / vCard Action */}
          {parsed.type === 'vcard' && (
            <button 
              className="btn-primary"
              onClick={() => {
                const blob = new Blob([scanResult.rawValue], { type: 'text/vcard' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${parsed.name || 'contact'}.vcf`;
                a.click();
              }}
              style={{ width: '100%' }}
            >
              <Download size={18} /> Save Contact Card (.vcf)
            </button>
          )}

          {/* General Actions (Copy, Share) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => handleCopy()}>
              {copied ? <CheckCircle2 size={16} color="var(--success)" /> : <Copy size={16} />}
              <span>{copied ? 'Copied Content!' : 'Copy Value'}</span>
            </button>
            <button className="btn-secondary" onClick={handleShare}>
              <Share2 size={16} /> Share
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
