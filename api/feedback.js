// Vercel Serverless Function: POST /api/feedback
// Validates admin auth, forwards selected PMIDs to Daisy's hook endpoint

const crypto = require('crypto');
const https = require('https');

function makeToken(password) {
  return crypto.createHmac('sha256', password).update('digest-admin').digest('hex').slice(0, 32);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    cookies[k] = v.join('=');
  });
  return cookies;
}

function postToHook(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const hookUrl = process.env.DAISY_HOOK_URL;
    const hookToken = process.env.DAISY_HOOK_TOKEN;

    if (!hookUrl || !hookToken) {
      return reject(new Error('Hook URL/token not configured'));
    }

    const url = new URL(hookUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hookToken}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate auth cookie
  const cookies = parseCookies(req.headers.cookie);
  const expected = process.env.DIGEST_ADMIN_PASSWORD;

  if (!expected) {
    res.status(500).json({ error: 'Not configured' });
    return;
  }

  const expectedToken = makeToken(expected);
  if (cookies['digest-auth'] !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { selected, shown } = req.body || {};

  if (!Array.isArray(selected) || selected.length === 0) {
    res.status(400).json({ error: 'No papers selected' });
    return;
  }

  try {
    const hookResult = await postToHook({
      type: 'digest-feedback',
      timestamp: new Date().toISOString(),
      selected,
      shown: shown || [],
      totalShown: (shown || []).length,
      totalSelected: selected.length
    });

    res.status(200).json({
      ok: true,
      papersSubmitted: selected.length,
      hookStatus: hookResult.status
    });
  } catch (err) {
    console.error('Hook error:', err);
    res.status(502).json({ error: 'Failed to submit feedback', detail: err.message });
  }
};
