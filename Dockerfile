# syntax=docker/dockerfile:1
# TransPort ERP: Next.js en modo standalone. Uso: docker compose up (ver docker-compose.yml y README).

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias. El postinstall genera el cliente de Prisma, por eso se copia antes el esquema.
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# Compilación
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Las variables NEXT_PUBLIC_* quedan incrustadas en el JavaScript del navegador al compilar
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# La compilación no consulta la base; SESSION_SECRET solo debe existir y se vuelve a leer al ejecutar
RUN NEXT_OUTPUT=standalone SESSION_SECRET=solo-para-compilar DATABASE_URL=postgresql://compilacion@localhost/compilacion npm run build

# Migraciones y datos de demostración (necesita el CLI de Prisma y tsx)
FROM builder AS migrator
CMD ["sh", "scripts/docker-migrar.sh"]

# Servidor de producción: solo los archivos que Next.js determinó necesarios, con usuario sin privilegios
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
