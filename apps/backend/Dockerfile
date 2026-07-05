FROM node:20-alpine

LABEL org.opencontainers.image.title="Todo Backend" \
      org.opencontainers.image.description="Node.js Todo API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Junaid Rao"

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

ENV NODE_ENV=production

EXPOSE 5000

USER node

CMD ["node", "src/index.js"]
