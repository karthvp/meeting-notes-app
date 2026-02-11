const crypto = require('crypto');

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  'karthik-patil-sandbox';
const EGEN_DOMAIN = '@egen.ai';

let cachedCerts = null;
let cachedCertsExpiry = 0;

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return email.trim().toLowerCase();
}

function isEgenAiEmail(email) {
  const normalized = normalizeEmail(email);
  return !!normalized && normalized.endsWith(EGEN_DOMAIN);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  const signature = base64UrlDecode(parts[2]);

  return {
    header,
    payload,
    signature,
    signedContent: `${parts[0]}.${parts[1]}`,
  };
}

function getCacheMaxAgeMs(cacheControlHeader) {
  if (!cacheControlHeader) return 0;
  const match = cacheControlHeader.match(/max-age=(\d+)/i);
  if (!match) return 0;
  return Number.parseInt(match[1], 10) * 1000;
}

async function getFirebaseSigningCerts() {
  if (cachedCerts && Date.now() < cachedCertsExpiry) {
    return cachedCerts;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase signing certs (${response.status})`);
  }

  cachedCerts = await response.json();
  const maxAgeMs = getCacheMaxAgeMs(response.headers.get('cache-control'));
  cachedCertsExpiry = Date.now() + Math.max(maxAgeMs, 5 * 60 * 1000);
  return cachedCerts;
}

function assertJwtClaims(payload) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${PROJECT_ID}`;

  if (payload.aud !== PROJECT_ID) {
    throw new Error('Invalid token audience');
  }

  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer');
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token subject');
  }

  if (typeof payload.exp !== 'number' || nowSeconds >= payload.exp) {
    throw new Error('Token expired');
  }

  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) {
    throw new Error('Invalid token issue time');
  }
}

async function verifyFirebaseIdToken(idToken) {
  const parsed = parseJwt(idToken);
  if (parsed.header.alg !== 'RS256') {
    throw new Error('Unexpected token algorithm');
  }

  assertJwtClaims(parsed.payload);

  const certs = await getFirebaseSigningCerts();
  const cert = certs[parsed.header.kid];
  if (!cert) {
    throw new Error('Unknown signing key');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(parsed.signedContent);
  verifier.end();
  const valid = verifier.verify(cert, parsed.signature);

  if (!valid) {
    throw new Error('Invalid token signature');
  }

  return parsed.payload;
}

function getRequestValue(req, location, key) {
  const source = location === 'query' ? req.query : req.body;
  if (!source) return undefined;
  return source[key];
}

function deny(res, status, error, message) {
  res.status(status).json({ error, message });
}

async function authenticateRequest(req, res, options = {}) {
  const { emailFields = [] } = options;
  const idToken = getBearerToken(req);

  if (!idToken) {
    deny(res, 401, 'Unauthorized', 'Missing Firebase ID token');
    return null;
  }

  let tokenPayload;
  try {
    tokenPayload = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    console.error('ID token verification failed:', error.message);
    deny(res, 401, 'Unauthorized', 'Invalid Firebase ID token');
    return null;
  }

  const authenticatedEmail = normalizeEmail(tokenPayload.email);
  if (!authenticatedEmail) {
    deny(res, 401, 'Unauthorized', 'Authenticated token has no email');
    return null;
  }

  if (!isEgenAiEmail(authenticatedEmail)) {
    deny(res, 403, 'Forbidden', 'User email must be @egen.ai');
    return null;
  }

  for (const field of emailFields) {
    const value = getRequestValue(req, field.location, field.key);
    if (!value) continue;

    const requestedEmail = normalizeEmail(value);
    if (requestedEmail !== authenticatedEmail) {
      deny(res, 403, 'Forbidden', 'Authenticated user does not match requested userEmail');
      return null;
    }
  }

  return {
    uid: tokenPayload.user_id || tokenPayload.sub,
    email: authenticatedEmail,
    tokenPayload,
  };
}

function getDriveAccessToken(req) {
  const headerToken = req.headers['x-drive-access-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken.trim();
  }

  if (req.body?.accessToken && typeof req.body.accessToken === 'string') {
    return req.body.accessToken.trim();
  }

  return null;
}

module.exports = {
  authenticateRequest,
  getDriveAccessToken,
  isEgenAiEmail,
  normalizeEmail,
};
