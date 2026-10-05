/**
 * Categorizes and parses any scanned QR code payload
 * @param {string} text
 * @returns {Object} { type, title, details, actions, raw }
 */
export function parseQRContent(text) {
  if (!text || typeof text !== 'string') {
    return { type: 'text', title: 'Plain Text', details: text, raw: text };
  }

  const trimmed = text.trim();

  // 1. Check if it's our rich Document / Media Viewer link!
  if (trimmed.includes('#/view') || trimmed.includes('/view?id=') || trimmed.includes('/view?v=')) {
    return {
      type: 'attached_media',
      title: 'Attached Document & Media',
      details: 'This QR code contains an attached document/media. Click below to open and view it in high resolution.',
      raw: trimmed,
      actions: ['view_document', 'copy_link', 'share']
    };
  }

  // 2. Wi-Fi Config (WIFI:S:MyNetwork;T:WPA;P:MyPassword;;)
  if (trimmed.startsWith('WIFI:') || trimmed.startsWith('wifi:')) {
    const ssidMatch = trimmed.match(/S:([^;]+)/i);
    const passMatch = trimmed.match(/P:([^;]+)/i);
    const typeMatch = trimmed.match(/T:([^;]+)/i);
    const hiddenMatch = trimmed.match(/H:([^;]+)/i);

    const ssid = ssidMatch ? ssidMatch[1] : 'Unknown Network';
    const password = passMatch ? passMatch[1] : '';
    const security = typeMatch ? typeMatch[1] : 'WPA';

    return {
      type: 'wifi',
      title: `Wi-Fi: ${ssid}`,
      ssid,
      password,
      security,
      hidden: hiddenMatch ? hiddenMatch[1] === 'true' : false,
      details: `Security: ${security}${password ? ` • Password: ${password}` : ' (Open Network)'}`,
      raw: trimmed,
      actions: ['copy_password', 'connect_wifi']
    };
  }

  // 3. vCard Contact (BEGIN:VCARD ... END:VCARD)
  if (trimmed.toUpperCase().includes('BEGIN:VCARD')) {
    const fnMatch = trimmed.match(/FN:(.+)/i) || trimmed.match(/N:([^;]+);([^;]+)/i);
    const telMatch = trimmed.match(/TEL.*:(.+)/i);
    const emailMatch = trimmed.match(/EMAIL.*:(.+)/i);
    const orgMatch = trimmed.match(/ORG:(.+)/i);
    const titleMatch = trimmed.match(/TITLE:(.+)/i);

    const name = fnMatch ? (fnMatch[1] || `${fnMatch[2]} ${fnMatch[1]}`).trim() : 'Contact Card';
    const phone = telMatch ? telMatch[1].trim() : '';
    const email = emailMatch ? emailMatch[1].trim() : '';
    const org = orgMatch ? orgMatch[1].trim() : '';
    const jobTitle = titleMatch ? titleMatch[1].trim() : '';

    return {
      type: 'vcard',
      title: name,
      name,
      phone,
      email,
      org,
      jobTitle,
      details: [org, phone, email].filter(Boolean).join(' • '),
      raw: trimmed,
      actions: ['download_vcf', 'call_phone', 'send_email']
    };
  }

  // 4. UPI Payment (upi://pay?pa=...&pn=...)
  if (trimmed.startsWith('upi://') || trimmed.includes('upi://pay')) {
    let pa = '';
    let pn = '';
    let am = '';
    let tn = '';
    try {
      const urlObj = new URL(trimmed);
      pa = urlObj.searchParams.get('pa') || '';
      pn = urlObj.searchParams.get('pn') || '';
      am = urlObj.searchParams.get('am') || '';
      tn = urlObj.searchParams.get('tn') || '';
    } catch (e) {
      pa = trimmed;
    }

    return {
      type: 'upi',
      title: `UPI Payment: ${pn || pa}`,
      payee: pa,
      name: pn,
      amount: am ? `₹${am}` : null,
      note: tn,
      details: `Payee: ${pa}${am ? ` • Amount: ₹${am}` : ''}`,
      raw: trimmed,
      actions: ['open_upi', 'copy_upi_id']
    };
  }

  // 5. Standard Web URL / Links
  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    let hostname = '';
    try {
      hostname = new URL(fullUrl).hostname;
    } catch (e) {
      hostname = trimmed;
    }

    return {
      type: 'url',
      title: hostname,
      url: fullUrl,
      details: fullUrl,
      raw: trimmed,
      actions: ['open_link', 'copy_link', 'share']
    };
  }

  // 6. Email (mailto:user@example.com)
  if (trimmed.startsWith('mailto:') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const email = trimmed.replace(/^mailto:/i, '').split('?')[0];
    return {
      type: 'email',
      title: `Email: ${email}`,
      email,
      details: email,
      raw: trimmed,
      actions: ['send_email', 'copy_email']
    };
  }

  // 7. Telephone (tel:+1234567890)
  if (trimmed.startsWith('tel:') || /^\+?[0-9\s\-()]{7,}$/.test(trimmed)) {
    const phone = trimmed.replace(/^tel:/i, '');
    return {
      type: 'phone',
      title: `Phone: ${phone}`,
      phone,
      details: phone,
      raw: trimmed,
      actions: ['call_phone', 'copy_phone']
    };
  }

  // 8. SMS (sms:+1234567890?body=hello)
  if (trimmed.startsWith('sms:') || trimmed.startsWith('smsto:')) {
    const num = trimmed.replace(/^(sms|smsto):/i, '').split('?')[0];
    return {
      type: 'sms',
      title: `SMS to ${num}`,
      phone: num,
      details: trimmed,
      raw: trimmed,
      actions: ['send_sms', 'copy_phone']
    };
  }

  // 9. Geo Location (geo:37.7749,-122.4194)
  if (trimmed.startsWith('geo:')) {
    const coords = trimmed.replace(/^geo:/i, '').split('?')[0].split(',');
    const lat = coords[0];
    const lng = coords[1];
    return {
      type: 'geo',
      title: `Location: ${lat}, ${lng}`,
      lat,
      lng,
      details: `Latitude: ${lat}, Longitude: ${lng}`,
      raw: trimmed,
      actions: ['open_maps', 'copy_coords']
    };
  }

  // 10. Default Plain Text
  return {
    type: 'text',
    title: 'Text Content',
    details: trimmed.length > 120 ? trimmed.substring(0, 120) + '...' : trimmed,
    raw: trimmed,
    actions: ['copy_text']
  };
}
