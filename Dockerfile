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
# Accept build args so Vite can inline the correct VITE_* values at build time
ARG NODE_ENV=production
ARG VITE_API_BASE=""
ARG VITE_WS_URL=""
ENV NODE_ENV=${NODE_ENV}
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_WS_URL=${VITE_WS_URL}
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
