Production deployment checklist

1) Prepare environment variables (in your host provider):
   - MERCADO_PAGO_ACCESS_TOKEN (live token: APP_USR-...)
   - MERCADO_PAGO_PUBLIC_KEY (optional, public key for frontend)
   - WEBHOOK_SECRET (shared secret for webhook HMAC)
   - PRINT_WEBHOOK_URL (URL where to post order summaries when payment confirmed)
   - FRONTEND_ORIGIN (your frontend domain for CORS)

2) Build frontend
   ```markdown
   Checklist para deploy em produção

   1) Preparar variáveis de ambiente (no provedor de hospedagem):
      - MERCADO_PAGO_ACCESS_TOKEN (token de produção: APP_USR-...)
      - MERCADO_PAGO_PUBLIC_KEY (opcional, chave pública para frontend)
      - WEBHOOK_SECRET (segredo compartilhado para validação HMAC do webhook)
      - PRINT_WEBHOOK_URL (URL para onde serão enviados resumos de pedido quando o pagamento for confirmado)
      - FRONTEND_ORIGIN (domínio do frontend para CORS)

   2) Build do frontend
      - npm run build
      - Envie a pasta `dist/` para Vercel/Netlify ou qualquer serviço de hospedagem estática

   3) Deploy do backend (exemplo: Render)
      - Crie um novo Web Service
      - Repo: aponte para este repositório
      - Comando de build: nenhum (o servidor é Node simples)
      - Comando de start: `node server/index.js`
      - Environment: configure as variáveis do passo 1
      - Garanta que o TLS (HTTPS) esteja habilitado e que você tenha uma URL pública

   4) Configurar webhook do Mercado Pago
      - Defina a URL do webhook para https://<seu-backend>/api/webhook
      - Defina o segredo do webhook para o mesmo valor de WEBHOOK_SECRET
      - Teste via dashboard do Mercado Pago ou fazendo uma transação de teste

   5) Testes
      - Crie um pedido no frontend -> PIX -> escaneie e pague
      - Verifique se o backend recebe o webhook e encaminha o orderData para PRINT_WEBHOOK_URL
      - Verifique se o frontend recebe a atualização via WebSocket

   6) Remover quaisquer flags SKIP ou DEV do código antes do deploy final.

   Observações:
   - Utilize um banco leve (Postgres) se quiser persistência mais robusta que o `payments.json` local.
   - Não publique segredos. Use as variáveis de ambiente do provedor.

Deploy no Easy Panel
--------------------

Abaixo está um passo a passo específico para publicar tanto o front-end quanto o back-end neste repositório usando o Easy Panel (painel de hospedagem que suporta serviços Node e sites estáticos). Ajuste nomes de serviços, portas e variáveis conforme seu provedor.

Pré-requisitos
- Tenha acesso ao repositório (Git) e ao painel do Easy Panel.
- Certifique-se de ter as variáveis sensíveis listadas acima (MERCADO_PAGO_ACCESS_TOKEN, WEBHOOK_SECRET, PRINT_WEBHOOK_URL, FRONTEND_ORIGIN, etc.).

1) Build do Frontend (local ou CI)
- No seu ambiente local ou pipeline CI, gere a pasta de build:

```powershell
# instalar dependências e gerar build
npm ci ; npm run build
```

- Isso criará a pasta `dist/` (o Vite coloca o build padrão em `dist`).
- Opções de publicação no Easy Panel:
   - Publicar como site estático: crie um novo "Static Site" no Easy Panel e aponte o diretório de publicação para o conteúdo da pasta `dist/`. Faça upload via deploy automático do repositório (se suportado) ou usando o zip do `dist/`.
   - Servir via backend Node: se quiser um único serviço que entregue o front e o API no mesmo domínio, pule a publicação estática e use o serviço Node descrito abaixo (servidor deve ser configurado para servir os arquivos de `dist/`).

2) Deploy do Backend (serviço Node no Easy Panel)
- Crie um novo "Web Service" ou "Node Service" no Easy Panel e configure:
   - Repo: aponte para este repositório (branch principal ou tag desejada).
   - Build command: (opcional) `npm ci` dentro da pasta `server` — alguns painéis executam build na raiz; verifique as opções do Easy Panel.
   - Start command: `node server/index.js` (ou `npm start` dentro de `server` se configurado).
   - Port: o Easy Panel normalmente injeta a porta via `PORT` ou direciona tráfego para a porta 3000; verifique como o painel define a porta. Assegure que `server/index.js` usa `process.env.PORT || 3000`.

- Variáveis de ambiente (exemplo mínimo a configurar no painel):
   - MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
   - MERCADO_PAGO_PUBLIC_KEY=...
   - WEBHOOK_SECRET=um-segredo-forte
   - PRINT_WEBHOOK_URL=https://exemplo.com/print
   - FRONTEND_ORIGIN=https://seu-frontend
   - VITE_WS_URL=wss://seu-backend (se aplicável)

- SSL/TLS: ative HTTPS no Easy Panel (geralmente automático com Let's Encrypt). Use o domínio fornecido pelo painel ou o seu domínio customizado.

3) Servir `dist/` a partir do backend (opcional)
- Se preferir que o backend entregue o frontend (mesmo domínio para Cookies/WebSocket), modifique `server/index.js` para servir arquivos estáticos de `../dist` (ou `dist` se você copiar o build para `server/dist`). Exemplo mínimo:

- Workflow recomendado:
   1. Gerar `dist/` via pipeline.
   2. No momento do deploy, copie `dist/` para `server/dist` (ou ajuste o path no Express).
   3. Start do serviço com `node server/index.js` que serve API + arquivos estáticos.

4) WebSocket e CORS
- Se o frontend e backend estiverem em domínios diferentes, configure `FRONTEND_ORIGIN` corretamente e ajuste CORS no servidor.
- Para WebSocket, exponha `wss://` (TLS) ou `ws://` conforme suporte do painel. No Easy Panel, garanta que o serviço aceite conexões WebSocket (alguns painéis exigem configuração adicional ou usam um proxy que passa WS).

5) Webhooks Mercado Pago
- Configure a URL do webhook no painel do Mercado Pago para `https://<seu-domínio>/api/webhook`.
- Use o mesmo `WEBHOOK_SECRET` configurado nas variáveis de ambiente para validar HMAC no servidor.

6) Persistência e réplicas
- O projeto atualmente usa `server/payments.json` para armazenar dados de pagamento. Em ambientes com múltiplas réplicas ou escalonamento, isso não é confiável.
- Recomenda-se usar um banco (Postgres, MySQL) ou um armazenamento persistente provido pelo Easy Panel (ou volume persistente ligado ao serviço).

7) Testes pós-deploy
- No frontend: crie um pedido e inicie um pagamento PIX.
- No backend: verifique logs do serviço para confirmar que os webhooks chegaram e que o servidor postou para `PRINT_WEBHOOK_URL`.
- Verifique se o frontend recebeu atualizações via WebSocket.

8) Notas de segurança
- Nunca escreva tokens em código versionado. Use apenas variáveis de ambiente do painel.
- Remova quaisquer flags `DEV`/`SKIP` antes de publicar.

Exemplo básico de comandos para usar localmente antes de subir ao painel:

```powershell
# build frontend
npm ci ; npm run build

# preparar server (copiar dist para server)
Remove-Item -Recurse -Force server\dist -ErrorAction SilentlyContinue ;
Copy-Item -Recurse -Force dist server\dist

# executar localmente (para testar antes do deploy)
cd server ; npm ci ; node index.js
```

Próximos passos (opcionais que posso implementar):
- Gerar um `Dockerfile` para o backend e/ou um `Dockerfile` multi-stage que cria o `dist` e serve tudo via Node/Express (útil se o Easy Panel aceitar imagens Docker).
- Implementar no `server/index.js` o código para servir `server/dist` automaticamente (se preferir essa estratégia). 

---

Fim da seção Easy Panel.
   ```
