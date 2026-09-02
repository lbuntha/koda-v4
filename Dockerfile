# syntax=docker/dockerfile:1
#
# Koda's Node side: the SPA, the Gemini proxy, the /api/live socket, and the
# /v1 proxy in front of the FastAPI service. One file, three useful targets:
#
#   dev   source is mounted, Vite runs in middleware mode  (make dev-local)
#   prod  the built app served by the bundled server        (make prod-local)
#
# The Python service has its own Dockerfile in server/ — see docs/BACKEND.md.

# ---------- dependencies, shared by every stage ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Only the manifests, so a source edit does not reinstall the world.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- development ----------
FROM deps AS dev
ENV NODE_ENV=development
# The source itself arrives as a bind mount from compose, so nothing is copied
# here — an edit on the host is the same file the container is running.
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ---------- build ----------
FROM deps AS build
COPY . .
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN npm run build

# ---------- production ----------
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# The server bundle keeps its dependencies external, so express, ws and the
# Gemini SDK still have to be here — but nothing from devDependencies does.
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.cjs"]
