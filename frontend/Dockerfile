# syntax=docker/dockerfile:1.7
#
# Frontend image: builds the Vite SPA, then serves the static bundle via
# nginx. Used by infrastructure/helm/njord-frontend chart.

# ---- build stage ---------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy only what `npm run build` needs.
COPY index.html tsconfig*.json vite.config.ts eslint.config.js ./
COPY eslint-rules ./eslint-rules
COPY public ./public
COPY frontend ./frontend

RUN npm run build

# ---- runtime stage -------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine-slim

# nginx-unprivileged listens on 8080 by default; rewrite to 80 to match
# the Service / IngressRoute used by njord-frontend chart.
USER root
RUN sed -i 's|listen[[:space:]]*8080;|listen 80;|' /etc/nginx/conf.d/default.conf

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER 101
EXPOSE 80
