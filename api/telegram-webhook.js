// api/telegram-webhook.js
// ============================================================
// THIS IS THE MOST IMPORTANT FILE - IT HANDLES BUTTON CLICKS
// ============================================================

export default async function handler(req, res) {
  // Allow GET requests for testing
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Webhook is active',
      timestamp: new Date().toISOString(),
      message: 'Send POST requests to this endpoint'
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('Missing TELEGRAM_BOT_TOKEN');
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  try {
    const update = req.body;
    console.log('📨 Webhook received:', JSON.stringify(update, null, 2));

    // ============================================================
    // ====== HANDLE BUTTON CLICKS (CALLBACK QUERY) ==============
    // ============================================================

    if (update.callback_query) {
      const callback = update.callback_query;
      const data = callback.data; // "approve_SESS_xxx" or "reject_SESS_xxx"
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const callbackId = callback.id;
      
      // Parse the session ID
      const parts = data.split('_');
      const action = parts[0]; // "approve" or "reject"
      const sessionId = parts.slice(1).join('_'); // "SESS_1234567890_abc123"

      console.log(`🔔 Callback: ${action} for ${sessionId}`);

      // ====== 1. ACKNOWLEDGE THE CALLBACK ======
      // This is REQUIRED - Telegram will retry if not acknowledged
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackId,
          text: `Processing ${action}...`
        })
      });

      // ====== 2. GET PENDING APPROVALS ======
      const pendingApprovals = global.pendingApprovals || new Map();

      // ====== 3. PROCESS THE DECISION ======
      if (pendingApprovals.has(sessionId)) {
        const entry = pendingApprovals.get(sessionId);
        const decision = action === 'approve' ? 'approved' : 'rejected';
        pendingApprovals.set(sessionId, { ...entry, status: decision });
        global.pendingApprovals = pendingApprovals;
        
        console.log(`✅ Session ${sessionId} ${decision}`);

        // ====== 4. UPDATE THE MESSAGE ======
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

        // ====== 5. SEND CONFIRMATION ======
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ DECISION RECORDED\nSession: ${sessionId}\nDecision: ${decision.toUpperCase()}`,
            parse_mode: 'HTML'
          })
        });

        return res.status(200).json({ success: true });

      } else {
        console.log(`❌ Session ${sessionId} not found`);
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ ERROR\nSession ${sessionId} not found.`
          })
        });

        return res.status(200).json({ success: true });
      }
    }

    // ============================================================
    // ====== HANDLE TEXT COMMANDS ================================
    // ============================================================

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

      return res.status(200).json({ success: true });
    }

    // ============================================================
    // ====== DEFAULT =============================================
    // ============================================================

    else {
      return res.status(200).json({ success: true });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}