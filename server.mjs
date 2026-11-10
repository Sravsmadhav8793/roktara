import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';

process.umask(0o077);
const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
const origin = required('APP_ORIGIN');
const rpID = new URL(origin).hostname;
const email = required('ADMIN_EMAIL').toLowerCase();
const passwordHash = required('ADMIN_PASSWORD_SCRYPT');
const reviewerEmail = (process.env.REVIEW_EMAIL || '').toLowerCase();
const reviewerPasswordHash = process.env.REVIEW_PASSWORD_SCRYPT || '';
if (Boolean(reviewerEmail) !== Boolean(reviewerPasswordHash)) throw new Error('Review email and password hash must be configured together');
if (reviewerEmail && reviewerEmail === email) throw new Error('Review account must differ from owner account');
const secret = new TextEncoder().encode(required('APP_SECRET'));
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const db = new DatabaseSync(process.env.PASSKEY_DB || '/data/passkeys.db');
db.exec(`CREATE TABLE IF NOT EXISTS passkey_credentials (
  id TEXT PRIMARY KEY, public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_used_at TEXT,
  account TEXT NOT NULL DEFAULT 'owner'
) STRICT`);
if (!db.prepare('PRAGMA table_info(passkey_credentials)').all().some(column => column.name === 'account')) {
  db.exec("ALTER TABLE passkey_credentials ADD COLUMN account TEXT NOT NULL DEFAULT 'owner'");
}
const indexHtml = readFileSync('./dist/index.html', 'utf8');
const app = new Hono();
const attempts = new Map();

function cookieOptions(c, maxAge) {
  return { httpOnly: true, secure: !c.req.header('host')?.startsWith('localhost:'), sameSite: 'Lax', path: '/', maxAge };
}
function validOrigin(c) {
  return c.req.header('origin') === origin && c.req.header('host') === new URL(origin).host;
}
async function issueSession(c, account = email) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' })
    .setSubject(`local:${account}`).setIssuedAt().setExpirationTime('12h').sign(secret);
  setCookie(c, 'roktara_session', token, cookieOptions(c, 12 * 3600));
  return c.json({ success: true });
}
async function sessionRole(c) {
  const token = getCookie(c, 'roktara_session');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.sub === `local:${email}`) return 'owner';
    if (reviewerEmail && payload.sub === `local:${reviewerEmail}`) return 'reviewer';
    return null;
  } catch { return null; }
}
async function hasSession(c) { return Boolean(await sessionRole(c)); }
function matchesPassword(candidate, configuredHash) {
  const [salt, expectedHex] = configuredHash.split(':');
  const expected = /^[a-f0-9]{128}$/i.test(expectedHex || '') ? Buffer.from(expectedHex, 'hex') : Buffer.alloc(64);
  const actual = scryptSync(typeof candidate === 'string' ? candidate : '', salt || 'invalid', 64);
  return timingSafeEqual(actual, expected);
}
async function remember(c, name, kind, challenge, account = email) {
  const token = await new SignJWT({ kind, challenge }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('sravantix-private-auth').setAudience(origin).setSubject(`local:${account}`)
    .setIssuedAt().setExpirationTime('5m').sign(secret);
  setCookie(c, name, token, cookieOptions(c, 300));
}
async function consume(c, name, kind, account = email) {
  const token = getCookie(c, name);
  deleteCookie(c, name, { path: '/' });
  if (!token) throw new Error('Missing challenge');
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: 'sravantix-private-auth', audience: origin });
  if (payload.sub !== `local:${account}` || payload.kind !== kind || typeof payload.challenge !== 'string') throw new Error('Invalid challenge');
  return payload.challenge;
}
function rows(role) { return role ? db.prepare('SELECT * FROM passkey_credentials WHERE account = ?').all(role) : db.prepare('SELECT * FROM passkey_credentials').all(); }
const accountFor = role => role === 'owner' ? email : reviewerEmail;

app.get('/api/auth/me', async c => {
  const role = await sessionRole(c);
  return role ? c.json({ email: role === 'owner' ? email : reviewerEmail }) : c.json({ error: 'Sign in required' }, 401);
});
app.post('/api/logout', c => { deleteCookie(c, 'roktara_session', { path: '/' }); return c.json({ success: true }); });
app.post('/api/login', bodyLimit({ maxSize: 4096 }), async c => {
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  const address = c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  const attempt = attempts.get(address);
  if (attempt && attempt.until > now && attempt.count >= 5) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
  try {
    const body = await c.req.json();
    const account = typeof body.email === 'string' ? body.email.toLowerCase() : '';
    const ownerValid = matchesPassword(body.password, passwordHash) && account === email;
    const reviewerValid = reviewerEmail && matchesPassword(body.password, reviewerPasswordHash) && account === reviewerEmail;
    if (!ownerValid && !reviewerValid) throw new Error('Invalid password');
    attempts.delete(address);
    return issueSession(c, reviewerValid ? reviewerEmail : email);
  } catch {
    attempts.set(address, { count: (attempt?.until > now ? attempt.count : 0) + 1, until: now + 15 * 60_000 });
    return c.json({ error: 'Invalid email or password' }, 401);
  }
});

app.get('/api/signin/options', async c => {
  if (!googleClientId) return c.json({ googleClientId: null, googleNonce: null });
  const nonce = randomBytes(32).toString('base64url');
  await remember(c, 'private_google_nonce', 'google', nonce);
  return c.json({ googleClientId, googleNonce: nonce });
});
app.post('/api/signin/google', bodyLimit({ maxSize: 8192 }), async c => {
  if (!googleClientId) return c.json({ error: 'Google sign-in is unavailable' }, 503);
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  try {
    const nonce = await consume(c, 'private_google_nonce', 'google');
    const { credential } = await c.req.json();
    if (typeof credential !== 'string' || credential.length > 8192) throw new Error('Invalid credential');
    const { payload } = await jwtVerify(credential, googleKeys, { audience: googleClientId, issuer: ['https://accounts.google.com', 'accounts.google.com'] });
    if (payload.nonce !== nonce || payload.email_verified !== true || payload.email?.toLowerCase() !== email || !payload.sub) throw new Error('Account not allowed');
    return issueSession(c);
  } catch { return c.json({ error: 'Google sign-in failed or this account is not allowed' }, 401); }
});

app.get('/api/passkey/list', async c => {
  const role = await sessionRole(c);
  if (!role) return c.json({ error: 'Sign in required' }, 401);
  return c.json({ passkeys: rows(role).map(row => ({ id: row.id, createdAt: row.created_at, lastUsedAt: row.last_used_at })) });
});
app.post('/api/passkey/register/options', async c => {
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  const role = await sessionRole(c);
  if (!role) return c.json({ error: 'Sign in required' }, 401);
  const account = accountFor(role);
  const options = await generateRegistrationOptions({
    rpName: 'Roktara', rpID, userName: account, userID: new TextEncoder().encode(`local:${account}`),
    attestationType: 'none', excludeCredentials: rows(role).map(row => ({ id: row.id })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, supportedAlgorithmIDs: [-7, -257],
  });
  await remember(c, 'private_passkey_challenge', 'register', options.challenge, account);
  return c.json(options);
});
app.post('/api/passkey/register/verify', bodyLimit({ maxSize: 65536 }), async c => {
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  const role = await sessionRole(c);
  if (!role) return c.json({ error: 'Sign in required' }, 401);
  try {
    const challenge = await consume(c, 'private_passkey_challenge', 'register', accountFor(role));
    const response = await c.req.json();
    const result = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!result.verified || !result.registrationInfo) throw new Error('Verification failed');
    const { credential } = result.registrationInfo;
    db.prepare('INSERT INTO passkey_credentials (id, public_key, counter, transports, account) VALUES (?, ?, ?, ?, ?)').run(
      credential.id, Buffer.from(credential.publicKey).toString('base64url'), credential.counter, JSON.stringify(credential.transports ?? []), role);
    return c.json({ success: true });
  } catch { return c.json({ error: 'Passkey registration failed' }, 400); }
});
app.post('/api/passkey/login/options', async c => {
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  const keys = rows();
  if (!keys.length) return c.json({ error: 'Sign in with Google or password, then add a passkey on this device.' }, 404);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: keys.map(row => ({ id: row.id })) });
  await remember(c, 'private_passkey_challenge', 'authenticate', options.challenge);
  return c.json(options);
});
app.post('/api/passkey/login/verify', bodyLimit({ maxSize: 65536 }), async c => {
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  try {
    const challenge = await consume(c, 'private_passkey_challenge', 'authenticate');
    const response = await c.req.json();
    if (typeof response.id !== 'string' || response.id.length > 255) throw new Error('Invalid credential');
    const row = db.prepare('SELECT * FROM passkey_credentials WHERE id = ?').get(response.id);
    if (!row || !['owner', 'reviewer'].includes(row.account) || (row.account === 'reviewer' && !reviewerEmail)) throw new Error('Unknown credential');
    const result = await verifyAuthenticationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: row.id, publicKey: Buffer.from(row.public_key, 'base64url'), counter: row.counter } });
    if (!result.verified) throw new Error('Verification failed');
    db.prepare('UPDATE passkey_credentials SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(result.authenticationInfo.newCounter, row.id);
    return issueSession(c, accountFor(row.account));
  } catch { return c.json({ error: 'Passkey sign-in failed' }, 401); }
});
app.post('/api/passkey/remove', bodyLimit({ maxSize: 4096 }), async c => {
  if (!validOrigin(c)) return c.json({ error: 'Invalid origin' }, 403);
  const role = await sessionRole(c);
  if (!role) return c.json({ error: 'Sign in required' }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.id !== 'string' || body.id.length > 255) return c.json({ error: 'Invalid passkey' }, 400);
  db.prepare('DELETE FROM passkey_credentials WHERE id = ? AND account = ?').run(body.id, role);
  return c.json({ success: true });
});

app.get('/assets/*', serveStatic({ root: './dist' }));
app.get('/.well-known/assetlinks.json', serveStatic({ root: './dist' }));
app.get('/icons/*', serveStatic({ root: './dist' }));
app.get('/manifest.webmanifest', serveStatic({ root: './dist' }));
app.get('/sw.js', serveStatic({ root: './dist' }));
app.get('/privacy.html', serveStatic({ root: './dist' }));
app.get('/delete-account.html', serveStatic({ root: './dist' }));
app.get('/*', async c => {
  if (c.req.path !== '/login' && !await hasSession(c)) return c.redirect('/login');
  return c.html(indexHtml);
});
app.onError((error, c) => { console.error('Roktara request failed', error); return c.json({ error: 'Server error' }, 500); });
serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
