import React, { useState } from 'react';
import { Database, X, CheckCircle2, Shield, Key, Folder, ExternalLink, AlertCircle } from 'lucide-react';
import { saveSupabaseConfig, getActiveBucketName, getSupabaseClient } from '../utils/cloudStorage';

export default function SupabaseSettingsModal({ onClose }) {
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('qr_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('qr_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [bucketName, setBucketName] = useState(() => getActiveBucketName());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingStatus, setTestingStatus] = useState('');
  const [testErrorMessage, setTestErrorMessage] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseKey, bucketName);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1500);
  };

  const handleTestConnection = async () => {
    setTestingStatus('testing');
    setTestErrorMessage('');
    try {
      saveSupabaseConfig(supabaseUrl, supabaseKey, bucketName);
      const client = getSupabaseClient();
      if (!client) {
        setTestingStatus('error');
        setTestErrorMessage('Invalid Supabase URL or Anon Key. Please check the values.');
        return;
      }
      const { data, error } = await client.storage.from(bucketName).list('', { limit: 1 });
      if (error) {
        console.error('Bucket test error:', error);
        setTestingStatus('error');
        const msg = error.message || String(error);
        if (/timeout|544|connection/i.test(msg)) {
          setTestErrorMessage('Your Supabase project is PAUSED by Supabase due to inactivity. Go to your Supabase dashboard and click "Restore project", wait 1-2 minutes, then test again.');
        } else {
          setTestErrorMessage(msg);
        }
      } else {
        setTestingStatus('success');
      }
    } catch (e) {
      setTestingStatus('error');
      setTestErrorMessage(e.message || 'Connection failed.');
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
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{ maxWidth: '540px', width: '100%', padding: '28px', position: 'relative' }}>
        
        <button 
          className="btn-ghost" 
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', padding: '6px' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Supabase Storage Setup</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Enable direct bucket uploads for global QR sharing on Vercel
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          Your Supabase Anon Key allows users' browsers to upload documents straight to your bucket without needing any backend server.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Project URL
            </label>
            <input 
              type="url"
              className="glass-input"
              placeholder="https://your-project-id.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Anon / Public API Key
            </label>
            <input 
              type="password"
              className="glass-input"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Public Bucket Name
            </label>
            <input 
              type="text"
              className="glass-input"
              placeholder="documents (Must be marked Public in Supabase)"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              required
            />
          </div>

          {testingStatus === 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} /> Connection verified! Bucket is active and readable.
            </div>
          )}

          {testingStatus === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--danger)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{testErrorMessage || 'Could not access bucket. Please verify your settings.'}</span>
              </div>
              {/paused|restore/i.test(testErrorMessage) && (
                <a 
                  href={`https://supabase.com/dashboard/project/${(supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]) || 'xxrydoqgbzloogfitvsm'}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-secondary)', textDecoration: 'underline', marginTop: '4px' }}
                >
                  Open Supabase Dashboard to Restore Project →
                </a>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-secondary" onClick={handleTestConnection} style={{ flex: 1 }}>
              Test Connection
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              {savedSuccess ? <CheckCircle2 size={18} /> : <Shield size={18} />}
              <span>{savedSuccess ? 'Saved!' : 'Save Credentials'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
