# Stage 1: build the Vite app
FROM node:20-alpine AS build

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build

# Stage 2: serve the static build with nginx
FROM nginx:1.27.2-alpine

LABEL org.opencontainers.image.title="Todo Frontend" \
      org.opencontainers.image.description="Vite frontend served by nginx" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Junaid Rao"

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

USER nginx
