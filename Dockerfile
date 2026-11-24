# ---- Etapa 1: compilar ----
# Aquí hace falta TODO (TypeScript, tipos...). Nada de esto viaja a la imagen final.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build

# ---- Etapa 2: ejecutar ----
# Solo las dependencias de producción y el JavaScript ya compilado.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Solo las migraciones: las usa el servicio "migrar" (node dist/migraciones/cli.js)
COPY db/migrations ./db/migrations

USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
