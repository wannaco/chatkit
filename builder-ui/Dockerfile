FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_PB_URL=http://localhost:8090
ARG VITE_BOT_SERVICE_URL=http://localhost:3001
ENV VITE_PB_URL=$VITE_PB_URL
ENV VITE_BOT_SERVICE_URL=$VITE_BOT_SERVICE_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.d/40-generate-config.sh
COPY --from=builder /app/build /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
