FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências em producao
RUN npm ci --only=production

# Copiar código do servidor
COPY . .

# Use PORT env var (default 3000)
ENV PORT=3000
EXPOSE ${PORT}

# Use npm start script (server/package.json has "start")
CMD ["sh", "-c", "node index.js"]