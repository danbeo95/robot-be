# Use Node.js 20 LTS Debian slim image (glibc required for uWebSockets.js native bindings)
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install git (required to clone uWebSockets.js git dependency) and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set default production environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    MONGODB_URI=mongodb://localhost:27017/robot-fleet

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose HTTP & WebSocket port
EXPOSE 8080

# Start backend server
CMD ["node", "app.js"]
