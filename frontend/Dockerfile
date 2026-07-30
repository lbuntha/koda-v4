# Koda frontend. Compose uses the `dev` target for Vite HMR; production uses the final
# nginx image built from the `build` target.
FROM node:20-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS dev
COPY . .
ENV VITE_API_URL=http://localhost:8000
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM dependencies AS build
COPY . .
# Baked into the build: the app calls "/api/..." which nginx proxies to the API.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
