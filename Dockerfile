# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Build do frontend (Vite)
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
RUN npm run build

# Production stage: serve built files with a tiny http server
FROM node:18-alpine

WORKDIR /app

# Install a tiny static server
RUN npm install -g serve@14

# Copy build output
COPY --from=builder /app/dist ./dist

# Expose configurable port via environment variable
ENV PORT=80
EXPOSE ${PORT}

# Start server with chosen port
CMD ["sh", "-c", "serve -s dist -l $PORT"]
