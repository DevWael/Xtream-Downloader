# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets
COPY --from=build /app/dist ./dist

# Copy server code
COPY server.js ./

# Expose port
EXPOSE 8080

# Create required directories for persistent storage
RUN mkdir -p /config

# Ensure node has access to /config
RUN chown -R node:node /config

USER node

# Start the Node.js express server
CMD ["node", "server.js"]
