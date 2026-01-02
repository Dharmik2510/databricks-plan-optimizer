# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for API URL
ARG VITE_API_URL=http://localhost:3001
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_SENTRY_DSN

# Copy package files from root
COPY package*.json ./
COPY frontend ./frontend/
COPY shared ./shared/
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY index.html ./
COPY public ./public/
COPY types.ts ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Set environment variable for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Build the application
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
