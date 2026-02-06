FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy backend files
COPY api ./api
COPY scripts ./scripts
COPY src ./src
COPY .env .env

# Expose port (adjust if necessary)
EXPOSE 3001

# Command to run the app
CMD ["node", "api/whatsapp-server-simple.js"]
