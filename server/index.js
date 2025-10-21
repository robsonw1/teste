import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mercadopago from 'mercadopago';
import { WebSocketServer } from 'ws';

// Load environment variables as early as possible
dotenv.config();

const app = express();

// Simple request logger to diagnose if requests (including OPTIONS) reach this app
app.use((req, res, next) => {
  try {
    const now = new Date().toISOString();
    const origin = req.headers && req.headers.origin ? req.headers.origin : '-';
    const proto = req.headers['x-forwarded-proto'] || req.protocol || '-';
    console.log(`[REQ] ${now} ${req.method} ${req.originalUrl} origin=${origin} proto=${proto}`);
  } catch (e) { /* ignore logging errors */ }
  return next();
});

// EARLY CORS: set CORS headers and short-circuit OPTIONS before any other middleware.
app.use((req, res, next) => {
  try {
    const originHeader = req.headers && req.headers.origin ? String(req.headers.origin) : (FRONTEND_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Origin', originHeader);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-idempotency-key,x-hub-signature-256,x-hub-signature,x-signature,x-driven-signature,x-admin-token');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  } catch (e) { /* ignore */ }
  return next();
});

// Enforce FRONTEND_ORIGIN in production
let FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*');
if (FRONTEND_ORIGIN) FRONTEND_ORIGIN = String(FRONTEND_ORIGIN).replace(/\/$/, '');
if (!FRONTEND_ORIGIN && process.env.NODE_ENV === 'production') {
  console.error('FRONTEND_ORIGIN must be set in production to restrict CORS. Aborting.');
  process.exit(1);
}

const corsOptions = {
  origin: true,
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-idempotency-key','x-hub-signature-256','x-hub-signature','x-signature','x-driven-signature','x-admin-token'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.options('/api/generate-pix', (req, res) => {
  try {
    const originHeader = req.headers && req.headers.origin ? String(req.headers.origin) : (FRONTEND_ORIGIN || '*');
    console.log('Received preflight OPTIONS for /api/generate-pix from', originHeader);
    res.setHeader('Access-Control-Allow-Origin', originHeader);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-idempotency-key,x-hub-signature-256,x-hub-signature,x-signature,x-driven-signature,x-admin-token');
    res.setHeader('Vary', 'Origin');
    return res.sendStatus(204);
  } catch (e) {
    return res.sendStatus(204);
  }
});

app.all('/api/debug-cors', (req, res) => {
  const originHeader = req.headers && req.headers.origin ? String(req.headers.origin) : (FRONTEND_ORIGIN || '*');
  console.log('DEBUG-CORS:', req.method, 'origin=', originHeader);
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-idempotency-key,x-hub-signature-256,x-hub-signature,x-signature,x-driven-signature,x-admin-token');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return res.json({ ok: true, method: req.method, originReceived: originHeader, headers: req.headers });
});

app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    const originHeader = req.headers && req.headers.origin ? String(req.headers.origin) : (FRONTEND_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Origin', originHeader);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-idempotency-key,x-hub-signature-256,x-hub-signature,x-signature,x-driven-signature,x-admin-token');
    res.setHeader('Vary', 'Origin');
    return res.sendStatus(204);
  }
  return next();
});

app.use((req, res, next) => {
  try {
    const hdr = res.getHeader && res.getHeader('Access-Control-Allow-Origin');
    if (!hdr) {
      const originHeader = req.headers && req.headers.origin ? String(req.headers.origin) : (FRONTEND_ORIGIN || '*');
      res.setHeader('Access-Control-Allow-Origin', originHeader);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-idempotency-key,x-hub-signature-256,x-hub-signature,x-signature,x-driven-signature,x-admin-token');
    }
  } catch (e) { /* ignore */ }
  return next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', true);
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto && String(proto).includes('http') && !String(proto).includes('https')) {
      const host = req.headers.host;
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    return next();
  });
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
function adminAuthMiddleware(req, res, next) {
  if (!ADMIN_TOKEN && process.env.NODE_ENV !== 'production') return next();
  const authHeader = req.headers.authorization || '';
  const bearer = String(authHeader).startsWith('Bearer ') ? String(authHeader).slice(7).trim() : null;
  const headerToken = req.headers['x-admin-token'] || null;
  const token = bearer || headerToken;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: admin token required' });
  }
  return next();
}

const LOGO_DIR = path.join(process.cwd(), 'data');
const LOGO_STORE = path.join(LOGO_DIR, 'logo.json');

(async () => {
  try { await fs.promises.mkdir(LOGO_DIR, { recursive: true }); } catch (e) { /* ignore */ }
})();

app.post('/api/admin/logo', adminAuthMiddleware, async (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl is required' });
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'invalid dataUrl' });
    const mime = m[1];
    const b64 = m[2];
    await fs.promises.writeFile(LOGO_STORE, JSON.stringify({ mime, b64 }, null, 2), 'utf8');
    try {
      const publicPath = path.join(process.cwd(), 'public', 'logotipoaezap.ico');
      const buf = Buffer.from(b64, 'base64');
      await fs.promises.writeFile(publicPath, buf);
      console.log('Wrote public logo to', publicPath);
    } catch (writeErr) {
      console.warn('Failed to write public logo file:', writeErr);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save admin logo:', err);
    return res.status(500).json({ error: 'failed to save logo' });
  }
});

app.get('/api/admin/logo', adminAuthMiddleware, async (req, res) => {
  try {
    const exists = await fs.promises.stat(LOGO_STORE).then(() => true).catch(() => false);
    if (!exists) {
      const placeholder = path.join(process.cwd(), 'public', 'placeholder.svg');
      if (await fs.promises.stat(placeholder).then(() => true).catch(() => false)) {
        const data = await fs.promises.readFile(placeholder);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(data);
      }
      return res.status(404).end();
    }
    const txt = await fs.promises.readFile(LOGO_STORE, 'utf8');
    const obj = JSON.parse(txt || '{}');
    if (!obj || !obj.b64 || !obj.mime) return res.status(404).end();
    const buffer = Buffer.from(obj.b64, 'base64');
    res.setHeader('Content-Type', obj.mime);
    return res.send(buffer);
  } catch (err) {
    console.error('Failed to serve admin logo:', err);
    res.status(500).end();
  }
});

const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
try {
  const t = String(ACCESS_TOKEN || '');
  const type = t.startsWith('TEST-') ? 'TEST' : (t.startsWith('APP_USR-') ? 'LIVE' : 'UNKNOWN');
  const masked = t ? `${t.slice(0,8)}...${t.slice(-6)}` : '<no-token>';
  console.log('Using Mercado Pago token:', masked, 'type:', type);
} catch (e) {}
if (!ACCESS_TOKEN) {
  console.error('ERROR: MERCADO_PAGO_ACCESS_TOKEN is not set. Aborting startup.');
  process.exit(1);
}

mercadopago.configurations.setAccessToken(ACCESS_TOKEN);

if (!process.env.MP_ACCESS_TOKEN && process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  process.env.MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
}
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || ACCESS_TOKEN;
if (MP_ACCESS_TOKEN && MP_ACCESS_TOKEN !== ACCESS_TOKEN) {
  try { mercadopago.configurations.setAccessToken(MP_ACCESS_TOKEN); } catch (e) { /* ignore */ }
}

async function validateMpToken() {
  try {
    const res = await fetch('https://api.mercadopago.com/users/me', { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } });
    if (res.status === 200) {
      console.log('Mercado Pago token validated (OK)');
      return true;
    }
    const text = await res.text();
    console.error('Mercado Pago token validation failed. Status:', res.status, 'Response:', text);
    return false;
  } catch (e) {
    console.error('Failed to validate Mercado Pago token at startup:', e);
    return false;
  }
}

const simulatedPayments = new Map();
const DEV_AUTO_APPROVE_SECONDS = Number(process.env.DEV_AUTO_APPROVE_SECONDS || '0');
const PAYMENTS_DB = path.join(process.cwd(), 'payments.json');

async function readPaymentsDb() {
  try {
    const txt = await fs.promises.readFile(PAYMENTS_DB, 'utf8');
    return JSON.parse(txt || '{}');
  } catch (e) {
    return {};
  }
}

async function writePaymentsDb(data) {
  await fs.promises.writeFile(PAYMENTS_DB, JSON.stringify(data, null, 2), 'utf8');
}

async function savePaymentRecord(id, record) {
  const db = await readPaymentsDb();
  db[id] = Object.assign(db[id] || {}, record, { updatedAt: new Date().toISOString() });
  await writePaymentsDb(db);
}

async function getPaymentRecord(id) {
  const db = await readPaymentsDb();
  return db[id] || null;
}

async function mpCreatePayment(body, idempotencyKey) {
  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'x-idempotency-key': idempotencyKey || ''
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text) } catch(e) { data = { raw: text } }
  return { status: res.status, data };
}

async function generateLocalPixPayload(orderId, amount) {
  try {
    const sanitizedAmount = Number(amount) || 0;
    const localCode = `00020126360014BR.GOV.BCB.PIX01${String(orderId).replace(/[^0-9]/g,'').slice(-14)}52040000530398654${String(Math.round(sanitizedAmount*100)).padStart(3,'0')}5802BR5925Empresa6009Cidade6108${String(Date.now()).slice(-8)}62070503***6304ABCD`;
    const qrPng = await QRCode.toDataURL(localCode, { width: 300 });
    const devId = `DEV-${Date.now()}`;
    simulatedPayments.set(devId, { status: 'pending', createdAt: Date.now() });
    try {
      await savePaymentRecord(devId, { id: devId, orderId, amount: sanitizedAmount, status: 'pending', createdAt: new Date().toISOString(), dev: true, fallback: true });
    } catch (e) { /* ignore */ }
    return { pix: localCode, qrBase64: qrPng.replace(/^data:image\/png;base64,/, ''), paymentId: devId };
  } catch (e) {
    throw e;
  }
}

app.post('/api/generate-pix-dev', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PIX_ENDPOINT !== '1') {
      return res.status(403).json({ error: 'Dev endpoint disabled in production' });
    }
    const amount = req.body.amount || req.body.transaction_amount || 0;
    const orderId = req.body.orderId || (`DEV-${Date.now()}`);
    console.log('DEV PIX endpoint requested for', orderId, amount);
    const { pix, qrBase64, paymentId } = await generateLocalPixPayload(orderId, amount);
    return res.json({ qrCodeBase64: qrBase64, pixCopiaECola: pix, paymentId, fallback: true });
  } catch (err) {
    console.error('/api/generate-pix-dev error', err);
    return res.status(500).json({ error: 'failed to generate dev pix', detail: String(err) });
  }
});

app.post('/api/generate-pix', async (req, res) => {
  try {
    let amount, orderId, orderData;
    
    if (req.body.amount && req.body.orderId) {
      ({ amount, orderId, orderData } = req.body);
    } else if (req.body.transaction_amount && req.body.description) {
      amount = req.body.transaction_amount;
      orderId = req.body.description.replace('Pedido #', '');
      orderData = req.body.orderData;
    } else {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        detail: 'amount/orderId ou transaction_amount/description são obrigatórios'
      });
    }

    if (!amount || !orderId) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        detail: 'amount e orderId são obrigatórios'
      });
    }

    const domain = process.env.MP_FAKE_EMAIL_DOMAIN || 'seudominio.com';
    const rawName = (req.body.payer && (req.body.payer.first_name || req.body.payer.name))
      || (req.body.orderData && req.body.orderData.customer && req.body.orderData.customer.name)
      || (req.body.orderData && req.body.orderData.customer && req.body.orderData.customer.fullName)
      || req.body.name
      || '';

    const rawPhone = (req.body.payer && (req.body.payer.phone || req.body.payer.phone_number))
      || (req.body.orderData && req.body.orderData.customer && req.body.orderData.customer.phone)
      || req.body.phone
      || '';

    function normalizeName(s) {
      try {
        return String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
      } catch (e) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      }
    }

    const cleanedName = normalizeName(rawName || '');
    const nameParts = cleanedName.split(/\s+/).filter(Boolean);
    const firstName = nameParts.length > 0 ? nameParts[0] : '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Cliente';
    const phoneDigits = String(rawPhone || '').replace(/[^0-9]/g, '') || String(Date.now()).slice(-9);
    const formattedLocalName = String(firstName || 'cliente')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .replace(/^\.+|\.+$/g, '') || 'cliente';
    const fakeEmail = `${formattedLocalName}.${phoneDigits}@${domain}`;

    const paymentData = {
      transaction_amount: Math.round(Number(amount) * 100) / 100,
      description: `Pedido #${orderId}`,
      payment_method_id: 'pix',
      payer: {
        first_name: firstName || 'Cliente',
        last_name: lastName || 'Cliente',
        email: (req.body.payer && req.body.payer.email) || fakeEmail,
        identification: {
          type: req.body.payer?.identification?.type || 'CPF',
          number: req.body.payer?.identification?.number || '19119119100'
        }
      }
    }

    console.log('Criando pagamento com dados:', JSON.stringify(paymentData, null, 2));

    const idempotencyKey = req.headers['x-idempotency-key'] || `idemp-${orderId}-${Date.now()}`;

    if (ACCESS_TOKEN && ACCESS_TOKEN.startsWith('TEST-')) {
      console.log('DEV: criando pagamento simulado para', orderId);
      const pix = '00020126360014BR.GOV.BCB.PIX0114+55119999999952040000530398654045.005802BR5925Empresa de Teste6009Sao Paulo61080540900062070503***6304ABCD';
      const qrPng = await QRCode.toDataURL(pix, { width: 300 });
      const devId = `DEV-${Date.now()}`;
      simulatedPayments.set(devId, { status: 'pending', createdAt: Date.now() });
      
      try {
        await savePaymentRecord(devId, { id: devId, orderId, amount, status: 'pending', createdAt: new Date().toISOString(), dev: true });
      } catch (saveError) {
        console.warn('Erro ao salvar registro DEV:', saveError.message);
      }
      
      if (DEV_AUTO_APPROVE_SECONDS > 0) {
        setTimeout(() => {
          simulatedPayments.set(devId, { status: 'approved', createdAt: Date.now() });
          console.log(`DEV: payment ${devId} auto-approved after ${DEV_AUTO_APPROVE_SECONDS}s`);
          try {
            savePaymentRecord(devId, { id: devId, orderId, amount, status: 'approved', createdAt: new Date().toISOString(), dev: true });
            tryBroadcastPayment({ id: devId, orderId, amount, status: 'approved', simulated: true });
          } catch (e) {
            console.warn('save dev approve failed', e);
          }
        }, DEV_AUTO_APPROVE_SECONDS * 1000);
      }

      return res.json({ qrCodeBase64: qrPng.replace(/^data:image\/png;base64,/, ''), pixCopiaECola: pix, paymentId: devId });
    }

    try {
      const mpBody = {
        ...paymentData,
        external_reference: orderId
      };
      const mpRes = await mercadopago.payment.create(mpBody, { headers: { 'x-idempotency-key': idempotencyKey } });
      const data = mpRes && mpRes.body ? mpRes.body : mpRes;
      console.log('MP SDK create result:', {
        id: data.id,
        status: data.status,
        hasQRCode: !!(data.point_of_interaction?.transaction_data?.qr_code_base64),
        hasPixCode: !!(data.point_of_interaction?.transaction_data?.qr_code)
      });

      if (data && data.status && Number(data.status) >= 400) {
        console.error('Mercado Pago returned error status', data.status, data);
        return res.status(Number(data.status)).json({ error: 'Mercado Pago error', detail: data });
      }

      const transaction_data = data.point_of_interaction && data.point_of_interaction.transaction_data;
      if (!transaction_data || !(transaction_data.qr_code_base64 || transaction_data.qr_code)) {
        console.error('No QR returned from MP create');
        return res.status(500).json({ error: 'QR code not returned by Mercado Pago' });
      }

      const qr_base64 = transaction_data.qr_code_base64;
      const qr_code = transaction_data.qr_code;
      const paymentId = data.id || (data && data.transaction_details && data.transaction_details.id) || null;
      
      try {
        await savePaymentRecord(String(paymentId || Date.now()), { 
          id: String(paymentId || ''), 
          orderId, 
          amount, 
          status: data.status || 'pending', 
          raw: data, 
          createdAt: new Date().toISOString(), 
          dev: false, 
          orderData: orderData || null 
        });
      } catch (saveError) {
        console.warn('Erro ao salvar registro de pagamento:', saveError.message);
      }

      tryBroadcastPayment({ id: String(paymentId || ''), orderId, amount, status: data.status || 'pending' });

      console.log('🎯 Enviando resposta:', {
        qrCodeBase64: qr_base64 ? `Presente (${qr_base64.length} chars)` : 'Ausente',
        pixCopiaECola: qr_code ? `Presente (${qr_code.length} chars)` : 'Ausente',
        paymentId: paymentId,
        status: data.status
      });

      return res.json({ 
        qrCodeBase64: qr_base64, 
        pixCopiaECola: qr_code, 
        paymentId: paymentId,
        status: data.status,
        statusDetail: data.status_detail 
      });
      
    } catch (sdkErr) {
      console.error('Mercado Pago SDK create error', sdkErr && sdkErr.message ? sdkErr.message : sdkErr);
      const sdkMsg = String((sdkErr && sdkErr.message) || sdkErr || '').toLowerCase();

      if (sdkMsg.includes('collector user') && sdkMsg.includes('key') && sdkMsg.includes('qr')) {
        if (process.env.ENABLE_LOCAL_PIX_FALLBACK === '1') {
          console.log('ENABLE_LOCAL_PIX_FALLBACK is set – generating local PIX QR as fallback');
          try {
            const pix = `00020126360014BR.GOV.BCB.PIX01${String(orderId).slice(-14)}520400005303986540${String(paymentData.transaction_amount).replace('.','')}5802BR5925Empresa6009Cidade6108${String(Date.now()).slice(-8)}62070503***6304ABCD`;
            const qrPng = await QRCode.toDataURL(pix, { width: 300 });
            const devId = `DEV-${Date.now()}`;
            simulatedPayments.set(devId, { status: 'pending', createdAt: Date.now() });
            try { await savePaymentRecord(devId, { id: devId, orderId, amount, status: 'pending', createdAt: new Date().toISOString(), dev: true, fallback: true }); } catch(e){}
            return res.json({ qrCodeBase64: qrPng.replace(/^data:image\/png;base64,/, ''), pixCopiaECola: pix, paymentId: devId, fallback: true });
          } catch (e) {
            console.warn('Local PIX fallback failed', e);
            return res.status(500).json({ error: 'Local PIX fallback failed', detail: String(e) });
          }
        }
        return res.status(400).json({
          error: 'Mercado Pago configuration error',
          detail: 'Collector account is not enabled for PIX QR generation.'
        });
      }

      if (String(sdkErr).toLowerCase().includes('unauthorized') || (sdkErr && sdkErr.status === 401)) {
        return res.status(401).json({ error: 'Unauthorized', detail: 'Check your MERCADO_PAGO_ACCESS_TOKEN.' });
      }

      const body = Object.assign({}, paymentData, { external_reference: orderId });
      const { status, data } = await mpCreatePayment(body, idempotencyKey);
      console.log('MP fallback create status', status, 'data keys:', Object.keys(data));

      if (status >= 400) {
        return res.status(status).json({ error: 'Mercado Pago error', detail: data });
      }
      
      const transaction_data = data.point_of_interaction && data.point_of_interaction.transaction_data;
      if (!transaction_data || !(transaction_data.qr_code_base64 || transaction_data.qr_code)) {
        return res.status(500).json({ error: 'QR code not returned by Mercado Pago', detail: data });
      }
      
      const qr_base64 = transaction_data.qr_code_base64;
      const qr_code = transaction_data.qr_code;
      
      try {
        await savePaymentRecord(String(data.id), { 
          id: String(data.id), 
          orderId, 
          amount, 
          status: data.status || 'pending', 
          raw: data, 
          createdAt: new Date().toISOString(), 
          dev: false, 
          orderData: orderData || null 
        });
      } catch (saveError) {
        console.warn('Erro ao salvar registro fallback:', saveError.message);
      }
      
      tryBroadcastPayment({ id: String(data.id), orderId, amount, status: data.status || 'pending' });
      
      return res.json({ qrCodeBase64: qr_base64, pixCopiaECola: qr_code, paymentId: data.id });
    }
  } catch (err) {
    console.error('generate-pix error', err)
    res.status(500).json({ error: 'Falha ao gerar PIX', detail: String(err) })
  }
})

app.get('/api/check-payment/:id', async (req, res) => {
  try {
    const id = req.params.id
    
    if (id && id.startsWith('DEV-')) {
      const entry = simulatedPayments.get(id);
      const status = entry ? entry.status : 'pending';
      return res.json({ status });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    
    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: 'Erro ao consultar pagamento' });
    }
    
    const data = await mpRes.json();
    console.log('Status consultado:', data.status);
    
    res.json({ status: data.status, raw: data });
  } catch (err) {
    console.error('Erro ao consultar pagamento:', err);
    res.status(500).json({ error: 'Falha ao consultar pagamento' });
  }
});

app.all('/api/generate-pix', (req, res) => {
  if (req.method === 'POST') return res.status(405).json({ error: 'Invalid method' });
  return res.status(405).json({ error: 'Method Not Allowed', detail: 'Use POST on this endpoint to create a PIX payment' });
});

app.get('/status-pagamento/:id', async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'payment id é obrigatório' })

    const ACCESS = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
    if (!ACCESS) return res.status(500).json({ error: 'MP access token não configurado' })

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${ACCESS}` }
    })

    const text = await mpRes.text()
    let data
    try { data = JSON.parse(text) } catch (e) { data = { raw: text } }

    if (mpRes.status >= 400) {
      return res.status(mpRes.status).json({ error: 'Erro ao consultar Mercado Pago', detail: data })
    }

    const status = data.status || null
    const status_detail = data.status_detail || null
    const date_approved = data.date_approved || null
    const result = { status, status_detail }
    if (date_approved && (String(status).toLowerCase() === 'approved' || String(status).toLowerCase() === 'paid' || String(status).toLowerCase() === 'success')) {
      result.date_approved = date_approved
    }

    try { await savePaymentRecord(String(id), { status: status, raw: data }); tryBroadcastPayment({ id: String(id), status, raw: data }); } catch (e) { /* ignore */ }
    return res.json(result)
  } catch (err) {
    console.error('/status-pagamento error', err)
    return res.status(500).json({ error: 'Falha ao consultar status do pagamento', detail: String(err) })
  }
})

app.post('/api/dev-approve/:id', (req, res) => {
  const id = req.params.id
  if (!id || !id.startsWith('DEV-')) return res.status(400).json({ error: 'Invalid dev id' })
  if (!simulatedPayments.has(id)) return res.status(404).json({ error: 'Dev id not found' })
  simulatedPayments.set(id, { status: 'approved', createdAt: Date.now() })
  console.log(`DEV: payment ${id} manually approved`)
  savePaymentRecord(id, { id, status: 'approved', updatedAt: new Date().toISOString(), dev: true }).catch(e=>console.warn('save dev approve failed', e));
  tryBroadcastPayment({ id, status: 'approved', simulated: true });
  res.json({ ok: true, id, status: 'approved' })
})

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.post('/api/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const raw = JSON.stringify(req.body || {})

    if (WEBHOOK_SECRET) {
      const sig = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'] || req.headers['x-signature'] || req.headers['x-driven-signature'] || '';
      if (!sig) {
        console.warn('Webhook received without signature while WEBHOOK_SECRET is set');
        return res.status(400).send('Missing signature');
      }
      const incoming = String(sig).replace(/^sha256=/i, '');
      const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
      if (hmac !== incoming) {
        console.warn('Webhook signature mismatch', incoming, hmac);
        return res.status(401).send('Invalid signature');
      }
    }

    const payload = req.body;
    console.log('Webhook payload:', payload);

    let paymentId = null;
    if (payload.data && payload.data.id) paymentId = String(payload.data.id);
    if (!paymentId && payload['id']) paymentId = String(payload['id']);

    if (!paymentId) {
      console.warn('Webhook has no payment id');
      return res.status(200).send('no-op');
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } });
    const text = await mpRes.text();
    let data
    try { data = JSON.parse(text) } catch(e) { data = { raw: text } }

    if (mpRes.status >= 400) {
      console.error('Error fetching payment from MP in webhook:', data);
      return res.status(500).send('mp-error');
    }

    await savePaymentRecord(paymentId, { status: data.status, raw: data });
    console.log('Webhook processed payment', paymentId, 'status', data.status);
    tryBroadcastPayment({ id: String(paymentId), status: data.status, raw: data });
    
    const printUrl = process.env.PRINT_WEBHOOK_URL;
    if (printUrl && (String(data.status).toLowerCase() === 'approved' || String(data.status).toLowerCase() === 'paid' || String(data.status).toLowerCase() === 'success')) {
      try {
        const rec = await getPaymentRecord(paymentId);
        if (rec && rec.orderData) {
          try {
            const pRes = await fetch(printUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rec.orderData)
            });
            if (!pRes.ok) {
              const pText = await pRes.text().catch(()=>'<no-text>');
              console.warn('Print webhook returned non-OK:', pRes.status, pText);
            } else {
              console.log('Order summary posted to print webhook for payment', paymentId);
            }
          } catch (e) {
            console.warn('Failed to post order to print webhook:', e);
          }
        } else {
          console.log('No orderData found for payment', paymentId);
        }
      } catch (e) {
        console.warn('Error looking up payment record for print forwarding', e);
      }
    }
    res.status(200).send('ok');
  } catch (e) {
    console.error('Webhook processing error', e);
    res.status(500).send('error');
  }
});

// ============================================
// ENDPOINT PRINCIPAL DE IMPRESSÃO /api/print
// ============================================
app.post('/api/print', express.json({ type: '*/*' }), async (req, res) => {
  const webhookUrl = process.env.PRINT_WEBHOOK_URL || 'https://n8nwebhook.aezap.site/webhook/impressao';
  
  console.log('📥 [/api/print] Requisição recebida');
  console.log('🔗 Webhook URL:', webhookUrl);
  
  try {
    // Validar body
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ Body vazio');
      return res.status(400).json({ 
        success: false,
        error: 'Body vazio',
        message: 'Dados do pedido são obrigatórios'
      });
    }

    // Validar orderId
    if (!req.body.orderId) {
      console.error('❌ orderId ausente');
      return res.status(400).json({ 
        success: false,
        error: 'orderId é obrigatório' 
      });
    }

    console.log('📦 OrderID:', req.body.orderId);
    console.log('📦 Items:', req.body.items?.length || 0);
    console.log('💰 Total:', req.body.totals?.total);

    // Salvar último pedido (não bloquear)
    try {
      const lastPath = path.join(LOGO_DIR, 'last-print.json');
      await fs.promises.writeFile(lastPath, JSON.stringify(req.body, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ Falha ao salvar backup:', e.message);
    }

    // Enviar para n8n
    console.log('🚀 Enviando para n8n...');
    const startTime = Date.now();

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Forneiro-Backend/1.0'
      },
      body: JSON.stringify(req.body),
      timeout: 30000 // 30 segundos
    });

    const elapsed = Date.now() - startTime;
    
    console.log('📥 Resposta recebida:');
    console.log('   Status:', upstream.status);
    console.log('   Tempo:', elapsed, 'ms');

    // Ler resposta
    const text = await upstream.text().catch(() => '');
    console.log('   Body length:', text.length);

    if (!upstream.ok) {
      console.error('❌ n8n retornou erro:', upstream.status);
      return res.status(502).json({ 
        success: false,
        error: 'Erro no webhook n8n',
        status: upstream.status,
        detail: text.slice(0, 500),
        orderId: req.body.orderId
      });
    }

    // Sucesso
    console.log('✅ Impressão enviada com sucesso!');
    
    try {
      const json = JSON.parse(text || '{}');
      return res.json({
        success: true,
        message: 'Pedido enviado para impressão',
        orderId: req.body.orderId,
        n8nResponse: json
      });
    } catch (e) {
      return res.json({
        success: true,
        message: 'Pedido enviado para impressão',
        orderId: req.body.orderId,
        n8nResponse: text
      });
    }

  } catch (err) {
    console.error('❌ Erro crítico:', err.message);
    console.error('Stack:', err.stack);
    
    return res.status(500).json({ 
      success: false,
      error: 'Erro ao processar impressão',
      detail: err.message,
      orderId: req.body.orderId || 'unknown'
    });
  }
});

app.post('/api/print-order', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const printUrl = process.env.PRINT_WEBHOOK_URL;
    if (!printUrl) {
      console.error('/api/print-order called but PRINT_WEBHOOK_URL is not set');
      return res.status(400).json({ error: 'PRINT_WEBHOOK_URL not configured on server' });
    }

    try {
      const bodyPreview = JSON.stringify(req.body || {}).slice(0, 2000);
      console.log(`[PRINT PROXY] Forwarding order to ${printUrl}. bodyPreview=${bodyPreview}`);
    } catch (e) {
      console.log('[PRINT PROXY] Forwarding order (could not serialize body preview)');
    }

    let pRes;
    let text = '';
    try {
      pRes = await fetch(String(printUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      text = await pRes.text().catch(() => '');
    } catch (fetchErr) {
      console.error('[PRINT PROXY] fetch to print webhook failed', fetchErr && fetchErr.stack ? fetchErr.stack : fetchErr);
      return res.status(500).json({ error: 'Failed to reach print webhook', detail: String(fetchErr) });
    }

    console.log(`[PRINT PROXY] print webhook responded status=${pRes.status} bodyPreview=${String(text || '').slice(0,2000)}`);

    if (!pRes.ok) {
      return res.status(502).json({ error: 'Print webhook error', status: pRes.status, detail: text });
    }

    try {
      const json = JSON.parse(text || 'null');
      return res.json({ ok: true, proxied: json });
    } catch (e) {
      return res.send(text || 'ok');
    }
  } catch (err) {
    console.error('Failed to proxy print webhook (unexpected)', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Failed to proxy print webhook', detail: String(err) });
  }
});

app.post('/api/print-test', async (req, res) => {
  try {
    const webhookUrl = process.env.PRINT_WEBHOOK_URL || 'https://n8nwebhook.aezap.site/webhook/impressao';
    const lastPath = path.join(LOGO_DIR, 'last-print.json');
    let payload = {};
    try {
      const txt = await fs.promises.readFile(lastPath, 'utf8');
      payload = JSON.parse(txt || '{}');
    } catch (e) {
      console.warn('/api/print-test: could not read last-print.json', e && e.message ? e.message : e);
      payload = req.body || { test: 'print-test' };
    }

    console.log('/api/print-test forwarding to', webhookUrl, 'payloadPreview=', JSON.stringify(payload).slice(0,2000));
    const ts = new Date().toISOString();
    console.log(`HTTP ${ts} OUT POST ${webhookUrl}`);

    const upstream = await fetch(String(webhookUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });

    const text = await upstream.text().catch(() => '');
    console.log('/api/print-test upstream status=', upstream.status, 'bodyPreview=', String(text || '').slice(0,2000));
    const ts2 = new Date().toISOString();
    console.log(`HTTP ${ts2} OUT POST ${webhookUrl} responded ${upstream.status}`);

    if (!upstream.ok) return res.status(502).json({ error: 'Print webhook error', status: upstream.status, detail: text });
    try { return res.json(JSON.parse(text || 'null')); } catch (e) { return res.send(text || 'ok'); }
  } catch (err) {
    console.error('/api/print-test error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'print-test failed', detail: String(err) });
  }
});

app.post('/api/print-echo', express.json({ type: '*/*' }), async (req, res) => {
  try {
    try {
      console.log('[/api/print-echo] received bodyPreview=', JSON.stringify(req.body || {}).slice(0,2000));
    } catch (e) {
      console.log('[/api/print-echo] received body (could not serialize)');
    }
    return res.json({ ok: true, received: req.body || null });
  } catch (err) {
    console.error('[/api/print-echo] error', err);
    return res.status(500).json({ error: 'echo failed' });
  }
});

async function createPaymentHandler(req, res) {
  try {
    const { transaction_amount, description, email, identificationType, identificationNumber } = req.body || {};

    if (!transaction_amount || !description || !email) {
      return res.status(400).json({ error: 'Dados inválidos. transaction_amount, description e email são obrigatórios.' });
    }

    const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
    if (!token) {
      return res.status(500).json({ error: 'MP access token não configurado no servidor (env MP_ACCESS_TOKEN).' });
    }

    const idempotencyKey = `idemp-${crypto.randomBytes(12).toString('hex')}`;

    const paymentBody = {
      transaction_amount: Number(transaction_amount),
      description: String(description),
      payment_method_id: 'pix',
      payer: {
        email: String(email),
        identification: {
          type: identificationType || 'CPF',
          number: identificationNumber || ''
        }
      }
    };

    const mpRes = await mercadopago.payment.create(paymentBody, { headers: { 'x-idempotency-key': idempotencyKey } });
    const data = mpRes && mpRes.body ? mpRes.body : mpRes;

    const paymentId = data.id || (data && data.transaction_details && data.transaction_details.id) || null;
    const status = data.status || null;
    const transaction_data = data.point_of_interaction && data.point_of_interaction.transaction_data;
    const qr_code_base64 = transaction_data && (transaction_data.qr_code_base64 || transaction_data.qr_code_base64);
    const qr_code = transaction_data && (transaction_data.qr_code || transaction_data.qr_code);
    const ticket_url = data.transaction_details && data.transaction_details.ticket_url ? data.transaction_details.ticket_url : (data.sandbox_init_point || data.init_point || null);

    return res.json({ id: paymentId, status, qr_code_base64, qr_code, ticket_url });
  } catch (err) {
    console.error('/criar-pagamento error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Falha ao criar pagamento', detail: String(err) });
  }
}

app.post('/criar-pagamento', createPaymentHandler);
app.post('/api/criar-pagamento', createPaymentHandler);

const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'

import http from 'http';
const server = http.createServer(app);

const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on('connection', (socket) => {
  console.log('WebSocket client connected');
  wsClients.add(socket);
  socket.on('close', () => {
    wsClients.delete(socket);
    console.log('WebSocket client disconnected');
  });
  socket.on('message', (msg) => {
    if (String(msg) === 'ping') socket.send('pong');
  });
});

function tryBroadcastPayment(payload) {
  const message = JSON.stringify({ type: 'payment_update', payload });
  for (const c of wsClients) {
    if (c.readyState === c.OPEN) {
      try { c.send(message); } catch (e) { console.warn('Failed to send ws message', e); }
    }
  }
}

(async () => {
  const ok = await validateMpToken();
  if (!ok) {
    console.error('Mercado Pago token invalid – server will not start. Fix MERCADO_PAGO_ACCESS_TOKEN and restart.');
    process.exit(1);
  }
  server.listen(port, host, () => console.log(`Server running on http://localhost:${port} (listening on ${host})`));
})();
