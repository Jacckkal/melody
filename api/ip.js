// api/ip.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get client IP from various headers
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               'Unknown';

    // Get location info (optional)
    let locationInfo = {};
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      if (response.ok) {
        locationInfo = await response.json();
      }
    } catch (e) {
      // Silently fail if geolocation service is unavailable
    }

    res.status(200).json({
      ip: ip,
      location: locationInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('IP detection error:', error);
    res.status(500).json({ error: 'Failed to detect IP' });
  }
}