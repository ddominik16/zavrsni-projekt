# Dva koraka: prvo se projekt izgradi u Nodeu, pa se gotove datoteke
# posluze nginxom. U gotovoj slici nema ni Nodea ni node_modules.

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite cita VITE_ varijable u trenutku builda i upisuje ih u kod,
# pa adresa API-ja mora biti poznata ovdje, a ne pri pokretanju.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
