FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build || npx tsc

EXPOSE 8080
CMD ["node", "dist/server.js"]
