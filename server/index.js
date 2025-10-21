const printWebhook = '/api/print'; // ✅ Correto - sempre usar o proxy local

try {
  console.log('📤 Enviando pedido para impressão...');
  console.log('Dados:', orderData);
  
  const resp = await fetch(printWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });

  console.log('📥 Resposta recebida:', resp.status);
  
  if (!resp.ok) {
    const errorText = await resp.text();
    console.error('❌ Erro ao enviar:', errorText);
    throw new Error(`Erro ao imprimir: ${resp.status}`);
  }

  const result = await resp.json();
  console.log('✅ Impressão enviada com sucesso:', result);
  
} catch (error) {
  console.error('❌ Erro ao enviar para impressão:', error);
  // Não bloquear a finalização do pedido por erro de impressão
}
