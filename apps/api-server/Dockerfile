# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api-server ./apps/api-server

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter @parkflow/shared build
RUN pnpm --filter @parkflow/pricing-engine build

# Build api-server
RUN pnpm --filter @parkflow/api-server build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy built files and necessary packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api-server/package.json ./apps/api-server/
COPY --from=builder /app/apps/api-server/dist ./apps/api-server/dist

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Create data directory for SQLite
RUN mkdir -p /app/apps/api-server/data

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/apps/api-server

CMD ["node", "dist/index.js"]
