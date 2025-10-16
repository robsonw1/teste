// index.js - Backend com CORS configurado corretamente

const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ========================================
// 1. CORS - CONFIGURAÇÃO CRÍTICA
// ========================================
// IMPORTANTE: CORS deve ser configurado ANTES de qualquer rota

const corsOptions = {
  origin: function (origin, callback) {
    // Lista de origens permitidas
    const allowedOrigins = [
      'https://app-forneiro-eden-app-forneiro.ilewqk.easypanel.host',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    // Permitir requisições sem origin (Postman, curl, etc)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Origin bloqueada:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400 // 24 horas
};

app.use(cors(corsOptions));

// Middleware adicional para garantir headers CORS em todas as respostas
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  
  const origin = req.headers.origin;
  if (origin && [
    'https://app-forneiro-eden-app-forneiro.ilewqk.easypanel.host',
    'http://localhost:5173'
  ].includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    return res.sendStatus(200);
  }
  
  next();
});

// ========================================
// 2. MIDDLEWARES DE PARSING
// ========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log de requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  console.log('Origin:', req.headers.origin || 'No origin');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// ========================================
// 3. MERCADO PAGO CONFIGURAÇÃO
// ========================================
let mercadoPagoClient;
let paymentService;

try {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('❌ MERCADO_PAGO_ACCESS_TOKEN não encontrado nas variáveis de ambiente');
    throw new Error('Token do Mercado Pago não configurado');
  }
  
  console.log('🔑 Token Mercado Pago:', accessToken.substring(0, 20) + '...');
  
  mercadoPagoClient = new MercadoPagoConfig({
    accessToken: accessToken,
    options: {
      timeout: 5000,
      idempotencyKey: 'forneiro-pix'
    }
  });
  
  paymentService = new Payment(mercadoPagoClient);
  
  console.log('✅ Mercado Pago configurado com sucesso');
} catch (error) {
  console.error('❌ Erro ao configurar Mercado Pago:', error.message);
  console.error('Stack:', error.stack);
}

// ========================================
// 4. ROTAS DE HEALTH CHECK
// ========================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Forneiro API',
    timestamp: new Date().toISOString(),
    mercadoPago: !!mercadoPagoClient,
    environment: process.env.NODE_ENV || 'development',
    routes: {
      health: 'GET /health',
      generatePix: 'POST /api/generate-pix',
      checkPayment: 'GET /api/payment/:id'
    }
  });
});

app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mercadoPago: {
      configured: !!mercadoPagoClient,
      hasToken: !!process.env.MERCADO_PAGO_ACCESS_TOKEN
    },
    server: {
      port: PORT,
      host: HOST,
      nodeVersion: process.version
    }
  };
  
  console.log('📊 Health check:', health);
  res.json(health);
});

// ========================================
// 5. ROTA GERAR PIX
// ========================================
app.post('/api/generate-pix', async (req, res) => {
  const requestId = Date.now();
  console.log('\n==========================================');
  console.log(`[${requestId}] 📍 POST /api/generate-pix`);
  console.log('==========================================');
  console.log('Origin:', req.headers.origin);
  console.log('Body recebido:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validar Mercado Pago
    if (!mercadoPagoClient || !paymentService) {
      console.error(`[${requestId}] ❌ Mercado Pago não configurado`);
      return res.status(500).json({
        success: false,
        error: 'Mercado Pago não configurado',
        details: 'Token de acesso não foi inicializado corretamente'
      });
    }

    // Extrair e validar dados
    const { amount, description, email } = req.body;

    console.log(`[${requestId}] 📋 Dados extraídos:`, { amount, description, email });

    // Validações
    if (!amount || isNaN(amount) || amount <= 0) {
      console.error(`[${requestId}] ❌ Valor inválido:`, amount);
      return res.status(400).json({
        success: false,
        error: 'Valor inválido',
        details: 'O campo "amount" deve ser um número maior que zero',
        received: { amount, type: typeof amount }
      });
    }

    if (!email || !email.includes('@')) {
      console.error(`[${requestId}] ❌ Email inválido:`, email);
      return res.status(400).json({
        success: false,
        error: 'Email inválido',
        details: 'É necessário fornecer um email válido',
        received: email
      });
    }

    // Preparar dados do pagamento
    const paymentData = {
      transaction_amount: Number(amount),
      description: description || 'Pagamento Forneiro',
      payment_method_id: 'pix',
      payer: {
        email: email,
        first_name: 'Cliente',
        last_name: 'Forneiro'
      }
    };

    console.log(`[${requestId}] 📤 Enviando para Mercado Pago:`, paymentData);

    // Criar pagamento
    const response = await paymentService.create({ body: paymentData });

    console.log(`[${requestId}] 📥 Resposta Mercado Pago:`, JSON.stringify(response, null, 2));

    // Validar resposta
    if (!response || !response.id) {
      throw new Error('Mercado Pago não retornou ID do pagamento');
    }

    // Extrair dados do PIX
    const pixInfo = response.point_of_interaction?.transaction_data;
    
    if (!pixInfo || !pixInfo.qr_code) {
      console.error(`[${requestId}] ❌ Dados PIX não encontrados:`, response);
      throw new Error('Dados do PIX não foram gerados pelo Mercado Pago');
    }

    const pixData = {
      id: response.id,
      status: response.status,
      qrCode: pixInfo.qr_code,
      qrCodeBase64: pixInfo.qr_code_base64,
      ticketUrl: pixInfo.ticket_url,
      amount: response.transaction_amount,
      createdAt: response.date_created
    };

    console.log(`[${requestId}] ✅ PIX gerado com sucesso:`, {
      id: pixData.id,
      amount: pixData.amount,
      status: pixData.status
    });

    res.status(200).json({
      success: true,
      payment: pixData
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ ERRO ao gerar PIX:`, error);
    console.error(`[${requestId}] Stack:`, error.stack);
    
    // Extrair mensagem de erro do Mercado Pago
    let errorMessage = error.message;
    let errorDetails = null;
    
    if (error.cause) {
      errorDetails = error.cause;
      console.error(`[${requestId}] Error cause:`, errorDetails);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar PIX',
      message: errorMessage,
      details: errorDetails,
      requestId: requestId
    });
  }
});

// ========================================
// 6. ROTA CONSULTAR PAGAMENTO
// ========================================
app.get('/api/payment/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`\n📍 GET /api/payment/${id}`);

  try {
    if (!paymentService) {
      return res.status(500).json({
        success: false,
        error: 'Mercado Pago não configurado'
      });
    }

    const response = await paymentService.get({ id });

    console.log(`📥 Status do pagamento ${id}:`, response.status);

    res.json({
      success: true,
      payment: {
        id: response.id,
        status: response.status,
        status_detail: response.status_detail,
        amount: response.transaction_amount,
        date_created: response.date_created,
        date_approved: response.date_approved
      }
    });

  } catch (error) {
    console.error(`❌ Erro ao consultar pagamento ${id}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Erro ao consultar pagamento',
      message: error.message
    });
  }
});

// ========================================
// 7. HANDLER 404
// ========================================
app.use('*', (req, res) => {
  console.log(`⚠️ Rota não encontrada: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: {
      health: 'GET /',
      healthCheck: 'GET /health',
      generatePix: 'POST /api/generate-pix',
      checkPayment: 'GET /api/payment/:id'
    }
  });
});

// ========================================
// 8. HANDLER DE ERROS GLOBAL
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ========================================
// 9. INICIAR SERVIDOR
// ========================================
const server = app.listen(PORT, HOST, () => {
  console.log('\n===========================================');
  console.log('🚀 SERVIDOR BACKEND FORNEIRO INICIADO');
  console.log('===========================================');
  console.log(`📍 URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Mercado Pago: ${mercadoPagoClient ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`🔑 Token presente: ${process.env.MERCADO_PAGO_ACCESS_TOKEN ? '✅ Sim' : '❌ Não'}`);
  console.log('===========================================');
  console.log('📋 Rotas disponíveis:');
  console.log('  GET  /              - Info do servidor');
  console.log('  GET  /health        - Health check');
  console.log('  POST /api/generate-pix  - Gerar PIX');
  console.log('  GET  /api/payment/:id   - Consultar pagamento');
  console.log('===========================================\n');
});

// ========================================
// 10. GRACEFUL SHUTDOWN
// ========================================
const shutdown = (signal) => {
  console.log(`\n⚠️ ${signal} recebido, encerrando servidor...`);
  
  server.close(() => {
    console.log('✅ Servidor encerrado gracefully');
    process.exit(0);
  });
  
  // Forçar encerramento após 10 segundos
  setTimeout(() => {
    console.error('❌ Forçando encerramento após timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handler de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

module.exports = app;
