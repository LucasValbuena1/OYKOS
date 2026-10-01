# Imagen base configurable (útil si Docker Hub limita descargas:
#   docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-alpine .)
ARG NODE_IMAGE=node:22-alpine

# ---------- 1. Dependencias ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Build (con verificación de tipos y pruebas) ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Si alguna prueba unitaria falla, la imagen no se construye.
RUN npm test -- --ci
RUN npm run build

# ---------- 3. Imagen final de ejecución ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
