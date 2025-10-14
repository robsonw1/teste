// Client-side proxy for Mercado Pago endpoints hosted on the server
// This file intentionally avoids importing the Mercado Pago SDK so it won't be bundled
// into the browser build. The server (server/index.js) holds the SDK and credentials.

// Prefer Vite runtime env for API base; fallback to relative paths
// @ts-ignore
const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? String(import.meta.env.VITE_API_BASE)
  : '';

export type GeneratePixResult = {
  qrCodeBase64?: string | null;
  qr_code_base64?: string | null;
  qr_code?: string | null;
  qrCode?: string | null;
  pixCopiaECola?: string | null;
  paymentId?: string | number | null;
  id?: string | number | null;
  status?: string | null;
  [key: string]: any;
}

export async function generatePix(amount: number, orderId: string): Promise<GeneratePixResult> {
  try {
    const res = await fetch(`${apiBase}/api/generate-pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId })
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('generatePix error', res.status, txt);
      throw new Error(`Erro ao gerar PIX: ${res.status}`);
    }

    const data = await res.json();
    // Normalize common alias fields so callers can use different conventions
    const qrCodeBase64 = data.qrCodeBase64 || data.qr_code_base64 || data.qrCode || null;
    const pixCopiaECola = data.pixCopiaECola || data.qr_code || data.qrCode || null;
    const paymentId = data.paymentId || data.id || null;

    return {
      // provide both canonical and alternative fields
      qrCodeBase64,
      qr_code_base64: qrCodeBase64,
      qrCode: qrCodeBase64,
      pixCopiaECola,
      qr_code: pixCopiaECola,
      paymentId,
      id: paymentId,
      status: data.status || null,
      // include original payload for debugging
      raw: data
    };
  } catch (err) {
    console.error('Erro ao gerar pagamento PIX (client proxy):', err);
    throw err;
  }
}

export async function checkPaymentStatus(paymentId: string) {
  try {
    const res = await fetch(`${apiBase}/api/check-payment/${encodeURIComponent(paymentId)}`);
    if (!res.ok) {
      const txt = await res.text();
      console.error('checkPaymentStatus error', res.status, txt);
      throw new Error(`Erro ao verificar status: ${res.status}`);
    }
    const data = await res.json();
    return data.status;
  } catch (err) {
    console.error('Erro ao verificar pagamento (client proxy):', err);
    throw err;
  }
}