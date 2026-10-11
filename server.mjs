import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
const port = Number(process.env.PORT || 3000);
const redirectUri = process.env.REDIRECT_URI;
const authUrl = process.env.AUTH_URL;
const tokenUrl = process.env.TOKEN_URL;
const clientId = process.env.CLIENT_ID;
const stateStore = new Map();
const sessionStore = new Map();

if (!redirectUri || !authUrl || !tokenUrl || !clientId) throw new Error('AUTH_URL, TOKEN_URL, CLIENT_ID, and REDIRECT_URI are required');

app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.json());

const base64Url = value => value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const cleanup = () => {
    const now = Date.now();
    for (const [key, value] of stateStore) if (value.expiresAt < now) stateStore.delete(key);
    for (const [key, value] of sessionStore) if (value.expiresAt < now) sessionStore.delete(key);
};

app.get('/auth/login', (req, res) => {
    cleanup();
    const state = base64Url(crypto.randomBytes(32));
    const verifier = base64Url(crypto.randomBytes(64));
    const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
    stateStore.set(state, { verifier, returnTo: typeof req.query.return_to === 'string' && req.query.return_to.startsWith('/') ? req.query.return_to : '/', expiresAt: Date.now() + 10 * 60 * 1000 });
    res.cookie('pkce_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/auth' });
    const url = new URL(authUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
});

app.get('/auth/callback', async (req, res) => {
    cleanup();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const saved = stateStore.get(state);
    stateStore.delete(state);
    if (!saved || req.cookies.pkce_state !== state || !code) return res.status(400).send('Invalid or expired PKCE callback.');
    try {
        const response = await fetch(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: redirectUri, code_verifier: saved.verifier }) });
        const tokens = await response.json();
        if (!response.ok || !tokens.access_token) return res.status(502).send('Token exchange failed.');
        const sessionId = base64Url(crypto.randomBytes(32));
        sessionStore.set(sessionId, { tokens, expiresAt: Date.now() + 60 * 60 * 1000 });
        res.clearCookie('pkce_state', { path: '/auth' });
        res.cookie('auth_session', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 1000, path: '/' });
        res.redirect(saved.returnTo);
    } catch {
        res.status(502).send('Token exchange unavailable.');
    }
});

app.get('/auth/session', (req, res) => {
    const session = sessionStore.get(req.cookies.auth_session);
    if (!session || session.expiresAt < Date.now()) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, ...session.tokens });
});

app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')));
app.use((_req, res) => res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist', 'index.html')));
app.listen(port, () => console.log(`[auth] Express PKCE server listening on ${port}`));
