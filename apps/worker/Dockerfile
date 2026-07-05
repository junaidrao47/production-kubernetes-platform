FROM node:20-alpine

LABEL org.opencontainers.image.title="Todo Worker" \
      org.opencontainers.image.description="Background worker for todo events" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Junaid Rao"

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

ENV NODE_ENV=production

USER node

CMD ["node", "src/index.js"]
