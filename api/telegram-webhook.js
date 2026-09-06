// api/telegram-webhook.js
export default async function handler(req, res) {
  // Handle both GET and POST
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Webhook is active',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('Missing TELEGRAM_BOT_TOKEN');
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  const update = req.body;
  console.log('📨 Webhook received:', JSON.stringify(update, null, 2));

  // ====== HANDLE BUTTON CLICKS ======
  if (update.callback_query) {
    const callback = update.callback_query;
    const data = callback.data;
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const callbackId = callback.id;
    
    // Parse: approve_SESS_123 or reject_SESS_123
    const parts = data.split('_');
    const action = parts[0];
    const sessionId = parts.slice(1).join('_');

    console.log(`🔔 Callback: ${action} for ${sessionId}`);

    // Acknowledge callback immediately
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text: `Processing ${action}...`
        })
      });
    } catch (e) {
      console.error('Answer callback error:', e);
    }

    // Get pending approvals from global storage
    const pendingApprovals = global.pendingApprovals || new Map();
    
    if (pendingApprovals.has(sessionId)) {
      const entry = pendingApprovals.get(sessionId);
      const decision = action === 'approve' ? 'approved' : 'rejected';
      pendingApprovals.set(sessionId, { ...entry, status: decision });
      global.pendingApprovals = pendingApprovals;
      
      console.log(`✅ Session ${sessionId} ${decision}`);

      // Update message buttons
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[
                { text: action === 'approve' ? '✅ APPROVED' : '❌ REJECTED', callback_data: 'done' }
              ]]
            }
          })
        });
      } catch (e) {
        console.error('Edit message error:', e);
      }

      // Send confirmation
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ DECISION RECORDED\nSession: ${sessionId}\nDecision: ${decision.toUpperCase()}`,
            parse_mode: 'HTML'
          })
        });
      } catch (e) {
        console.error('Send confirmation error:', e);
      }

      res.status(200).json({ success: true });
    } else {
      console.log(`❌ Session ${sessionId} not found`);
      
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ ERROR\nSession ${sessionId} not found.`
          })
        });
      } catch (e) {
        console.error('Send error message error:', e);
      }

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
        global.pendingApprovals = pendingApprovals;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ DECISION RECORDED\nSession: ${sessionId}\nDecision: ${decision.toUpperCase()}`,
            parse_mode: 'HTML'
          })
        });
      } else {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ ERROR\nSession ${sessionId} not found.`
          })
        });
      }
    }

    res.status(200).json({ success: true });
  }

  else {
    res.status(200).json({ success: true });
  }
}