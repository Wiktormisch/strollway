# Stage 1: build the React app. Build context is frontend/ (see docker-compose.yml).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty on purpose: the app calls "/api/..." paths on its own origin.
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: serve the built files and proxy the API.
FROM nginx:1.29-alpine
COPY --from=nginx_conf nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
