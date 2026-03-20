FROM node:20-slim

# Install Chromium for PDF headless rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

ENV BOOK_DE_RESULTADOS_PDF_BROWSER=/usr/bin/chromium
ENV BOOK_STORAGE_DIR=/data/output
ENV BOOK_PORT=3100
ENV NODE_ENV=production

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ src/
COPY server/ server/
COPY config/ config/
COPY schemas/ schemas/

# Create output directory
RUN mkdir -p /data/output

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/health').then(r=>{if(!r.ok)throw new Error();process.exit(0)}).catch(()=>process.exit(1))"

CMD ["node", "server/start.js"]
