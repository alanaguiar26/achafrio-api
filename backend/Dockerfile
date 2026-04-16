FROM node:22-bookworm-slim

WORKDIR /app

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
