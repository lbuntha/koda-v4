# Koda frontend — Vite build served by nginx, which also reverse-proxies /api
# to the backend container (so the browser talks to one origin, no CORS).
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Baked into the build: the app calls "/api/..." which nginx proxies to the API.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
