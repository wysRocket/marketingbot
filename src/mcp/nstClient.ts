import axios from 'axios';
import 'dotenv/config';

const apiKey = process.env.NSTBROWSER_API_KEY;
if (!apiKey) throw new Error('NSTBROWSER_API_KEY not set in .env');

const host = process.env.NSTBROWSER_HOST ?? 'localhost:8848';

export const nst = axios.create({
  baseURL: `http://${host}/api/v2`,
  headers: { 'x-api-key': apiKey },
  timeout: 30_000,
});

export const NST_WS_BASE = `ws://${host}/api/v2`;
export { apiKey, host };
