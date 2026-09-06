// api/telegram-webhook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('Missing TELEGRAM_BOT_TOKEN');
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  const update = req.body;
  console.log('Webhook received:', JSON.stringify(update, null, 2));

  // ====== HANDLE BUTTON CLICKS ======
  if (update.callback_query) {
    const callback = update.callback_query;
    const data = callback.data;
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const callbackId = callback.id;
    
    const parts = data.split('_');
    const action = parts[0];
    const sessionId = parts.slice(1).join('_');

    console.log(`Callback: ${action} for ${sessionId}`);

    await answerCallbackQuery(callbackId, `Processing ${action}...`);

    const pendingApprovals = global.pendingApprovals || new Map();
    
    if (pendingApprovals.has(sessionId)) {
      const entry = pendingApprovals.get(sessionId);
      const decision = action === 'approve' ? 'approved' : 'rejected';
      pendingApprovals.set(sessionId, { ...entry, status: decision });
      
      console.log(`Session ${sessionId} ${decision}`);

      await editMessageReplyMarkup(botToken, chatId, messageId, [
        [
          { 
            text: action === 'approve' ? 'APPROVED' : 'REJECTED', 
            callback_data: 'done' 
          }
        ]
      ]);

      await sendTelegramMessage(
        botToken,
        chatId,
        `DECISION RECORDED\nSession: ${sessionId}\nDecision: ${decision.toUpperCase()}`,
        'HTML'
      );

      res.status(200).json({ success: true });
    } else {
      console.log(`Session ${sessionId} not found`);
      await answerCallbackQuery(callbackId, 'Session not found');
      await sendTelegramMessage(
        botToken,
        chatId,
        `ERROR\nSession ${sessionId} not found.`,
        'HTML'
      );
      res.status(200).json({ success: true });
    }
  }

  // ====== HANDLE TEXT COMMANDS ======
  else if (update.message && update.message.text) {
    const text = update.message.text;
    const chatId = update.message.chat.id;
    
    const match = text.match(/^(APPROVE|REJECT)\s+(\w+)/i);
    if (match) {
      const action = match[1].toLowerCase();
      const sessionId = match[2];
      
      const pendingApprovals = global.pendingApprovals || new Map();
      
      if (pendingApprovals.has(sessionId)) {
        const entry = pendingApprovals.get(sessionId);
        const decision = action === 'approve' ? 'approved' : 'rejected';
        pendingApprovals.set(sessionId, { ...entry, status: decision });
        
        await sendTelegramMessage(
          botToken,
          chatId,
          `DECISION RECORDED\nSession: ${sessionId}\nDecision: ${decision.toUpperCase()}`,
          'HTML'
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          `ERROR\nSession ${sessionId} not found.`,
          'HTML'
        );
      }
    }

    res.status(200).json({ success: true });
  }

  else {
    res.status(200).json({ success: true });
  }
}

// ============================================================
// ====== HELPER FUNCTIONS ====================================
// ============================================================

async function answerCallbackQuery(callbackId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: false
      })
    });
  } catch (error) {
    console.error('Error answering callback:', error);
  }
}

async function editMessageReplyMarkup(botToken, chatId, messageId, inlineKeyboard) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      })
    });
  } catch (error) {
    console.error('Error editing message:', error);
  }
}

async function sendTelegramMessage(botToken, chatId, message, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}