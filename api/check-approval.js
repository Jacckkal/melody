// api/check-approval.js
import { pendingApprovals } from './telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  if (pendingApprovals.has(sessionId)) {
    const entry = pendingApprovals.get(sessionId);
    const status = entry.status || 'pending';
    
    if (status !== 'pending') {
      // Remove after checking (one-time use)
      pendingApprovals.delete(sessionId);
    }
    
    return res.status(200).json({ 
      status: status,
      data: entry.data
    });
  }
  
  // Session not found - may have been approved already or expired
  return res.status(200).json({ status: 'pending' });
}