FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3333
ENV HOST=0.0.0.0

RUN mkdir -p /app/uploads

EXPOSE 3333

CMD ["npm", "run", "start"]
