FROM node:22-slim

# Install ffmpeg dan build tools untuk native modules
RUN apt-get update && apt-get install -y ffmpeg python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY bot/package*.json ./
RUN npm install --production

COPY bot/ .

EXPOSE 4000

CMD ["node", "index.js"]
