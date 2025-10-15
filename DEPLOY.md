Production deployment checklist

1) Prepare environment variables (in your host provider):
   - MERCADO_PAGO_ACCESS_TOKEN (live token: APP_USR-...)
   - MERCADO_PAGO_PUBLIC_KEY (optional, public key for frontend)
   - WEBHOOK_SECRET (shared secret for webhook HMAC)
   - PRINT_WEBHOOK_URL (URL where to post order summaries when payment confirmed)
   - FRONTEND_ORIGIN (your frontend domain for CORS)
# Deploy (Easy Panel) — guia simplificado e seguro

Este documento descreve como publicar o frontend e o backend no Easy Panel usando o repositório GitHub com Dockerfiles.

Resumo das responsabilidades
- Frontend: build Vite -> pasta `dist/`; pode ser servido como Static Site ou via Docker image.
- Backend: servidor Node (Express) que expõe APIs e WebSocket; será empacotado em uma imagem Docker.

Variáveis de ambiente necessárias (mínimo)
- MERCADO_PAGO_ACCESS_TOKEN=APP_USR-... (obrigatório)
- MP_ACCESS_TOKEN=... (opcional, compatibilidade)
- WEBHOOK_SECRET=um-segredo-forte (recomendado para validar webhooks)
- PRINT_WEBHOOK_URL=https://... (opcional)
- FRONTEND_ORIGIN=https://seu-frontend (para CORS)
- VITE_API_BASE=https://app-forneiro-eden-backend-atualizado.ilewqk.easypanel.host (definir no build do frontend)
- VITE_WS_URL=wss://app-forneiro-eden-backend-atualizado.ilewqk.easypanel.host (definir no build do frontend)

Observações importantes sobre WebSocket (WSS)
- O frontend será servido via HTTPS; use `wss://` para WebSocket. Garanta que o Easy Panel (proxy/ingress) suporte WebSocket upgrades e TLS termination.

Passo-a-passo (usar GitHub -> Easy Panel com Dockerfile)

1) Confirme Dockerfiles
- Este repositório já contém Dockerfiles para frontend (root `Dockerfile`) e backend (`server/Dockerfile`). Eles usam a variável `PORT` e assumem que o backend escuta `process.env.PORT || 3000`.

2) Frontend: build e configuração de variáveis
- Antes de buildar o frontend (local ou CI), defina as variáveis Vite necessárias. Exemplo (local):

```powershell
# instalar dependencias e gerar build (local/CI)
npm ci ; npm run build
```

- Se você usar o Easy Panel para buildar a imagem direto do GitHub, defina a variável de ambiente `VITE_API_BASE` e `VITE_WS_URL` nas configurações de build do serviço (alguns painéis permitem definir ARG/ENV para build).

3) Criar serviço no Easy Panel para o backend (imagem via Dockerfile do repositório)
- No Easy Panel, crie um novo serviço do tipo Docker/GitHub-backed:
  - Fonte: Github repo `robsonw100-don/teste` branch `main` (conforme screenshot enviada).
  - Caminho do build: raiz (Dockerfile do frontend existente) — recomendar criar dois serviços separados: um para frontend (Static) e outro para backend (server/Dockerfile). Para backend aponte o Dockerfile para `server/Dockerfile`.
  - Build args / Environment: defina as variáveis listadas acima (MERCADO_PAGO_ACCESS_TOKEN, WEBHOOK_SECRET, PRINT_WEBHOOK_URL, FRONTEND_ORIGIN).
  - Port: 3000 (ou deixe em branco se o painel mapear automaticamente) — o servidor respeita `process.env.PORT`.
  - Start command: não é necessário (a imagem Docker já tem CMD).

4) Criar serviço no Easy Panel para o frontend
- Opcional: crie um Static Site (apontando para `dist/`) ou crie serviço Docker a partir do Dockerfile na raiz. Se usar Dockerfile na raiz, certifique-se de que a etapa de build do frontend roda corretamente no pipeline e que a imagem final serve a pasta `dist/` (o Dockerfile atualizado faz isso).

5) TLS / WSS
- Ative HTTPS no Easy Panel para os domínios. Depois de pronto, ajuste `VITE_API_BASE` para usar `https://` e `VITE_WS_URL` para `wss://` (domínio do backend). Teste com `wscat -c wss://your-backend` para validar suporte a WebSocket upgrades.

6) Testes pós-deploy
- Teste o endpoint diretamente com POST (exemplo PowerShell):

```powershell
$body = @{ amount = 10; orderId = "TEST-123" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://app-forneiro-eden-backend-atualizado.ilewqk.easypanel.host/api/generate-pix" -Method POST -Body $body -ContentType "application/json"
```

- Se o POST retornar JSON com qrCodeBase64/pixCopiaECola, o endpoint está funcionando.
- Verifique também GET (esperado 405 JSON):

```powershell
Invoke-WebRequest -Uri "https://app-forneiro-eden-backend-atualizado.ilewqk.easypanel.host/api/generate-pix" -Method GET -UseBasicParsing
```

7) Webhook Mercado Pago
- Configure no dashboard do Mercado Pago a URL `https://<seu-backend>/api/webhook` e o mesmo `WEBHOOK_SECRET`.

8) Dicas operacionais
- Se usar múltiplas réplicas, mova `payments.json` para um armazenamento compartilhado (DB ou volume persistente).
- Monitore logs do serviço para mensagens de erro sobre Mercado Pago ou falhas de WebSocket.

9) Problemas comuns e soluções rápidas
- Recebe HTML "Cannot GET /api/generate-pix" no navegador: isso é normal para GET — o endpoint exige POST. Se o frontend recebe HTML ao fazer POST, verifique `VITE_API_BASE` (se estiver vazio, a requisição cai no host do frontend que serve HTML).
- WebSocket bloqueado (Mixed Content): troque `ws://` por `wss://` e habilite TLS / WebSocket upgrades no painel.

Se quiser, eu posso:
- Adicionar um endpoint estático / healthcheck em `/healthz` que retorna JSON `{ok:true}` para facilitar o probe.
- Instruir passo-a-passo com screenshots do Easy Panel (já vi que você tem acesso ao repo no painel).

---

Fim.
- Workflow recomendado:
