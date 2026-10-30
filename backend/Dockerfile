# ==============================================================================
# Mediast Backend API - Production Dockerfile (Node.js 20 Alpine LTS)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Production environment settings
ENV NODE_ENV=production
ENV PORT=4000

# Install dependencies first for optimal Docker caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code and database assets
COPY src/ ./src/
COPY database/ ./database/

# Expose backend REST API port
EXPOSE 4000

# Start Express.js production server
CMD ["node", "src/index.js"]
