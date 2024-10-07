# Stage 1: Install dependencies and build the Next.js app
FROM node:22.9.0-alpine AS builder

# Install required system dependencies
RUN apk add --no-cache libc6-compat python3 make g++ bash

# Set working directory
WORKDIR /app

# Copy the package manager configuration and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@9.7.1 && pnpm install --frozen-lockfile

# Copy the rest of the project files
COPY . .

# Build the Next.js app
RUN pnpm run build

# Stage 2: Create a lightweight production image to serve the built app
FROM node:22.9.0-alpine AS runner

# Install required system dependencies (again if needed)
RUN apk add --no-cache bash

# Set environment variables for Next.js production
ENV NODE_ENV=production
ENV PORT=3000

# Expose the Next.js port
EXPOSE 3000

# Set working directory
WORKDIR /app

# Copy the built application and necessary files from the builder stage
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Command to run the Next.js app in production
CMD ["pnpm", "start"]
