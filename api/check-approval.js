// api/check-approval.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  const pendingApprovals = global.pendingApprovals || new Map();
  
  if (pendingApprovals.has(sessionId)) {
    const entry = pendingApprovals.get(sessionId);
    const status = entry.status || 'pending';
    
    if (status !== 'pending') {
      pendingApprovals.delete(sessionId);
    }
    
    return res.status(200).json({ status: status });
  }
  
  return res.status(200).json({ status: 'pending' });
}