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
import http from 'http';

// ========================================
// 1. CONFIGURAÇÃO INICIAL
// ========================================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Trust proxy (Easypanel/Nginx)
app.set('trust proxy', true);

// ========================================
// 2. CORS - CONFIGURAÇÃO CRÍTICA (PRIMEIRO!)
// ========================================
// Lista de origens permitidas
const ALLOWED_ORIGINS = [
  'https://app-forneiro-eden-app-forneiro.ilewqk.easypanel.host',
  'https://app-forneiro-eden-frontend.ilewqk.easypanel.host',
  'http://localhost:5173',
  'http://localhost:3000'
];

// Middleware CORS manual ANTES de tudo
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Se a origem está na lista permitida ou não há origem (curl/postman)
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-hub-signature-256, x-hub-signature, x-signature, x-driven-signature, x-admin-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  
  // Responder OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    console.log(`✅ OPTIONS ${req.path} from ${origin || 'no-origin'}`);
    return res.sendStatus(204);
  }
  
  next();
});

// CORS do pacote (redundância para garantir)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Origin bloqueada:', origin);
      callback(null, true); // Permitir mesmo assim em produção
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key', 'x-hub-signature-256', 'x-hub-signature', 'x-signature', 'x-driven-signature', 'x-admin-token'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// ========================================
// 3. BODY PARSERS
// ========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================================
// 4. LOGGER
// ========================================
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || 'no-origin';
  console.log(`[${timestamp}] ${req.method} ${req.path} | Origin: ${origin}`);
  next();
});

// ========================================
// 5. MERCADO PAGO CONFIGURAÇÃO
// ========================================
const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ MERCADO_PAGO_ACCESS_TOKEN não configurado!');
  process.exit(1);
}

// Log tipo de token
const tokenType = ACCESS_TOKEN.startsWith('TEST-') ? 'TEST' : 
                  ACCESS_TOKEN.startsWith('APP_USR-') ? 'LIVE' : 'UNKNOWN';
console.log(`🔑 Token Mercado Pago: ${ACCESS_TOKEN.substring(0, 15)}... (${tokenType})`);

// Configurar SDK
mercadopago.configurations.setAccessToken(ACCESS_TOKEN);

// Validar token
async function validateMpToken() {
  try {
    const res = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    
    if (res.status === 200) {
      const data = await res.json();
      console.log('✅ Token validado:', data.nickname || data.email);
      return true;
    }
    
    console.error('❌ Token inválido:', res.status);
    return false;
  } catch (e) {
    console.error('❌ Erro ao validar token:', e.message);
    return false;
  }
}

// ========================================
// 6. STORAGE
// ========================================
const PAYMENTS_DB = path.join(process.cwd(), 'payments.json');
const LOGO_DIR = path.join(process.cwd(), 'data');
const LOGO_STORE = path.join(LOGO_DIR, 'logo.json');

// Criar diretórios
(async () => {
  try {
    await fs.promises.mkdir(LOGO_DIR, { recursive: true });
  } catch (e) { /* ignore */ }
})();

async function readPaymentsDb() {
  try {
    const txt = await fs.promises.readFile(PAYMENTS_DB, 'utf8');
    return JSON.parse(txt || '{}');
  } catch (e) {
    return {};
  }
}

async function writePaymentsDb(data) {
  try {
    await fs.promises.writeFile(PAYMENTS_DB, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Erro ao salvar payments.json:', e.message);
  }
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

// ========================================
// 7. WEBSOCKET
// ========================================
const simulatedPayments = new Map();
const wsClients = new Set();
let wss;

function tryBroadcastPayment(payload) {
  const message = JSON.stringify({ type: 'payment_update', payload });
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(message);
        console.log('📡 Broadcast enviado:', payload.id);
      } catch (e) {
        console.warn('Erro ao enviar ws:', e.message);
      }
    }
  }
}

// ========================================
// 8. ROTAS DE HEALTH
// ========================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Forneiro Backend',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /',
      'GET /health',
      'POST /api/generate-pix',
      'GET /api/check-payment/:id',
      'GET /status-pagamento/:id',
      'POST /api/webhook'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mercadoPago: !!ACCESS_TOKEN,
    tokenType: tokenType,
    wsClients: wsClients.size
  });
});

// ========================================
// 9. ROTA PRINCIPAL: GERAR PIX
// ========================================
app.post('/api/generate-pix', async (req, res) => {
  const requestId = `REQ-${Date.now()}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${requestId}] 🎯 POST /api/generate-pix`);
  console.log(`Origin: ${req.headers.origin || 'no-origin'}`);
  console.log(`Body:`, JSON.stringify(req.body, null, 2));
  console.log('='.repeat(60));

  try {
    // Extrair dados (suportar múltiplos formatos)
    let amount, orderId, orderData;

    if (req.body.amount && req.body.orderId) {
      ({ amount, orderId, orderData } = req.body);
    } else if (req.body.transaction_amount && req.body.description) {
      amount = req.body.transaction_amount;
      orderId = req.body.description.replace('Pedido #', '');
      orderData = req.body.orderData;
    } else {
      console.error(`[${requestId}] ❌ Dados inválidos`);
      return res.status(400).json({
        error: 'Dados inválidos',
        detail: 'amount/orderId ou transaction_amount/description são obrigatórios',
        received: Object.keys(req.body)
      });
    }

    // Validar valores
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Valor inválido',
        detail: 'amount deve ser um número maior que zero',
        received: { amount, type: typeof amount }
      });
    }

    if (!orderId) {
      return res.status(400).json({
        error: 'ID do pedido obrigatório',
        detail: 'orderId é obrigatório'
      });
    }

    // Preparar dados do pagador
    const domain = process.env.MP_FAKE_EMAIL_DOMAIN || 'forneiro.app';
    
    const rawName = (req.body.payer && req.body.payer.first_name)
      || (req.body.orderData?.customer?.name)
      || (req.body.orderData?.customer?.fullName)
      || 'Cliente';

    const rawPhone = (req.body.payer?.phone)
      || (req.body.orderData?.customer?.phone)
      || String(Date.now()).slice(-9);

    function normalizeName(s) {
      return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    }

    const cleanedName = normalizeName(rawName);
    const nameParts = cleanedName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Forneiro';

    const phoneDigits = String(rawPhone).replace(/[^0-9]/g, '') || String(Date.now()).slice(-9);
    const formattedName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'cliente';
    const fakeEmail = `${formattedName}.${phoneDigits}@${domain}`;

    // Montar payload
    const paymentData = {
      transaction_amount: Math.round(Number(amount) * 100) / 100,
      description: `Pedido #${orderId}`,
      payment_method_id: 'pix',
      external_reference: orderId,
      payer: {
        first_name: firstName,
        last_name: lastName,
        email: req.body.payer?.email || fakeEmail,
        identification: {
          type: req.body.payer?.identification?.type || 'CPF',
          number: req.body.payer?.identification?.number || '00000000000'
        }
      }
    };

    console.log(`[${requestId}] 📤 Enviando para Mercado Pago...`);
    console.log(JSON.stringify(paymentData, null, 2));

    // Se token TEST, simular
    if (ACCESS_TOKEN.startsWith('TEST-')) {
      console.log(`[${requestId}] 🧪 Modo DEV: gerando PIX simulado`);
      
      const pix = '00020126360014BR.GOV.BCB.PIX0114+55119999999952040000530398654045.005802BR5925Forneiro6009Sao Paulo61080540900062070503***6304ABCD';
      const qrPng = await QRCode.toDataURL(pix, { width: 300 });
      const devId = `DEV-${Date.now()}`;
      
      simulatedPayments.set(devId, { status: 'pending', createdAt: Date.now() });
      
      await savePaymentRecord(devId, {
        id: devId,
        orderId,
        amount,
        status: 'pending',
        dev: true,
        createdAt: new Date().toISOString()
      });

      // Auto-aprovar em 5 segundos
      setTimeout(async () => {
        simulatedPayments.set(devId, { status: 'approved' });
        await savePaymentRecord(devId, { status: 'approved' });
        tryBroadcastPayment({ id: devId, orderId, status: 'approved' });
        console.log(`[${requestId}] ✅ DEV pagamento auto-aprovado`);
      }, 5000);

      console.log(`[${requestId}] ✅ PIX DEV gerado:`, devId);
      
      return res.json({
        qrCodeBase64: qrPng.replace(/^data:image\/png;base64,/, ''),
        pixCopiaECola: pix,
        paymentId: devId,
        status: 'pending',
        dev: true
      });
    }

    // Produção: usar Mercado Pago
    const idempotencyKey = req.headers['x-idempotency-key'] || `idemp-${orderId}-${Date.now()}`;

    try {
      const mpRes = await mercadopago.payment.create(paymentData, {
        headers: { 'x-idempotency-key': idempotencyKey }
      });

      const data = mpRes?.body || mpRes;

      console.log(`[${requestId}] 📥 Resposta MP:`, {
        id: data.id,
        status: data.status,
        hasQR: !!data.point_of_interaction?.transaction_data?.qr_code_base64
      });

      // Verificar se há erro
      if (data.status && Number(data.status) >= 400) {
        console.error(`[${requestId}] ❌ MP retornou erro:`, data);
        return res.status(data.status).json({
          error: 'Erro do Mercado Pago',
          detail: data
        });
      }

      const txData = data.point_of_interaction?.transaction_data;

      if (!txData?.qr_code && !txData?.qr_code_base64) {
        console.error(`[${requestId}] ❌ QR Code não retornado`);
        return res.status(500).json({
          error: 'QR Code não gerado',
          detail: 'Mercado Pago não retornou dados do PIX'
        });
      }

      const paymentId = String(data.id);

      // Salvar
      await savePaymentRecord(paymentId, {
        id: paymentId,
        orderId,
        amount,
        status: data.status,
        raw: data,
        createdAt: new Date().toISOString(),
        orderData
      });

      // Broadcast
      tryBroadcastPayment({
        id: paymentId,
        orderId,
        amount,
        status: data.status
      });

      console.log(`[${requestId}] ✅ PIX criado com sucesso:`, paymentId);

      return res.json({
        qrCodeBase64: txData.qr_code_base64,
        pixCopiaECola: txData.qr_code,
        paymentId: paymentId,
        status: data.status,
        statusDetail: data.status_detail
      });

    } catch (sdkErr) {
      console.error(`[${requestId}] ❌ Erro SDK:`, sdkErr.message);

      // Fallback REST
      try {
        const fallbackRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'x-idempotency-key': idempotencyKey
          },
          body: JSON.stringify(paymentData)
        });

        const fallbackData = await fallbackRes.json();

        if (!fallbackRes.ok) {
          return res.status(fallbackRes.status).json({
            error: 'Erro ao criar pagamento',
            detail: fallbackData
          });
        }

        const txData = fallbackData.point_of_interaction?.transaction_data;

        if (!txData?.qr_code) {
          return res.status(500).json({
            error: 'QR Code não gerado (fallback)',
            detail: fallbackData
          });
        }

        await savePaymentRecord(String(fallbackData.id), {
          id: String(fallbackData.id),
          orderId,
          amount,
          status: fallbackData.status,
          raw: fallbackData,
          createdAt: new Date().toISOString()
        });

        return res.json({
          qrCodeBase64: txData.qr_code_base64,
          pixCopiaECola: txData.qr_code,
          paymentId: fallbackData.id
        });

      } catch (fallbackErr) {
        console.error(`[${requestId}] ❌ Fallback falhou:`, fallbackErr.message);
        return res.status(500).json({
          error: 'Falha ao gerar PIX',
          detail: fallbackErr.message
        });
      }
    }

  } catch (err) {
    console.error(`[${requestId}] ❌ ERRO FATAL:`, err);
    return res.status(500).json({
      error: 'Erro interno',
      detail: err.message
    });
  }
});

// ========================================
// 10. CONSULTAR PAGAMENTO
// ========================================
app.get('/api/check-payment/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('DEV-')) {
      const entry = simulatedPayments.get(id);
      return res.json({ status: entry?.status || 'pending' });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: 'Erro ao consultar' });
    }

    const data = await mpRes.json();
    
    await savePaymentRecord(id, { status: data.status, raw: data });
    tryBroadcastPayment({ id, status: data.status });

    res.json({ status: data.status, statusDetail: data.status_detail });
  } catch (err) {
    console.error('Erro check-payment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/status-pagamento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: 'Erro MP', detail: data });
    }

    await savePaymentRecord(id, { status: data.status });
    tryBroadcastPayment({ id, status: data.status });

    res.json({
      status: data.status,
      status_detail: data.status_detail,
      date_approved: data.date_approved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// 11. WEBHOOK
// ========================================
app.post('/api/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook recebido:', req.body);

    const paymentId = req.body?.data?.id || req.body?.id;

    if (!paymentId) {
      return res.status(200).send('no-op');
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    const data = await mpRes.json();

    await savePaymentRecord(String(paymentId), { status: data.status, raw: data });
    tryBroadcastPayment({ id: String(paymentId), status: data.status });

    console.log('✅ Webhook processado:', paymentId, data.status);

    res.status(200).send('ok');
  } catch (e) {
    console.error('Erro webhook:', e);
    res.status(500).send('error');
  }
});

// ========================================
// 12. ADMIN LOGO
// ========================================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function adminAuthMiddleware(req, res, next) {
  if (!ADMIN_TOKEN && process.env.NODE_ENV !== 'production') return next();

  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-admin-token'];

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/admin/logo', adminAuthMiddleware, async (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });

    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'invalid dataUrl' });

    await fs.promises.writeFile(LOGO_STORE, JSON.stringify({ mime: m[1], b64: m[2] }), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/logo', adminAuthMiddleware, async (req, res) => {
  try {
    const exists = await fs.promises.stat(LOGO_STORE).then(() => true).catch(() => false);
    if (!exists) return res.status(404).end();

    const obj = JSON.parse(await fs.promises.readFile(LOGO_STORE, 'utf8'));
    const buffer = Buffer.from(obj.b64, 'base64');
    res.setHeader('Content-Type', obj.mime);
    res.send(buffer);
  } catch (err) {
    res.status(500).end();
  }
});

// ========================================
// 13. DEV HELPER
// ========================================
app.post('/api/dev-approve/:id', (req, res) => {
  const { id } = req.params;
  if (!id.startsWith('DEV-')) return res.status(400).json({ error: 'Invalid' });
  
  simulatedPayments.set(id, { status: 'approved' });
  savePaymentRecord(id, { status: 'approved' });
  tryBroadcastPayment({ id, status: 'approved' });
  
  res.json({ ok: true, id, status: 'approved' });
});

// ========================================
// 14. 404 HANDLER
// ========================================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// ========================================
// 15. ERROR HANDLER
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err);
  res.status(500).json({ error: 'Erro interno', detail: err.message });
});

// ========================================
// 16. INICIAR SERVIDOR
// ========================================
const server = http.createServer(app);

// WebSocket
wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  console.log('🔌 WebSocket conectado');
  wsClients.add(socket);

  socket.on('close', () => {
    wsClients.delete(socket);
    console.log('🔌 WebSocket desconectado');
  });

  socket.on('message', (msg) => {
    if (String(msg) === 'ping') socket.send('pong');
  });
});

// Start
(async () => {
  console.log('\n🚀 Iniciando servidor Forneiro...\n');

  const valid = await validateMpToken();
  if (!valid) {
    console.error('❌ Token inválido. Servidor não iniciará.');
    process.exit(1);
  }

  server.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ SERVIDOR FORNEIRO ONLINE');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://${HOST}:${PORT}`);
    console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💳 Mercado Pago: ${tokenType}`);
    console.log(`🔌 WebSocket: Ativo`);
    console.log('='.repeat(60));
    console.log('\n📋 Rotas disponíveis:');
    console.log('  GET  /               - Info');
    console.log('  GET  /health         - Health check');
    console.log('  POST /api/generate-pix   - Gerar PIX');
    console.log('  GET  /api/check-payment/:id');
    console.log('  POST /api/webhook');
    console.log('='.repeat(60) + '\n');
  });
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM recebido');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT recebido');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});
