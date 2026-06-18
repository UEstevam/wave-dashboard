const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const AUTH_CALLBACK_URL = process.env.AUTH_CALLBACK_URL || 'http://localhost:3001/api/auth/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-wave-change-in-prod';

function getOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_CALLBACK_URL);
}

function getAuthUrl() {
  return getOAuth2Client().generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
}

async function getUserInfoFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  const { data } = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();
  return {
    googleId: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { getAuthUrl, getUserInfoFromCode, signToken, verifyToken };
