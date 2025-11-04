FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build || npx tsc

EXPOSE 8080
ENV NODE_ENV=development
# Force unbuffered output
ENV NODE_NO_WARNINGS=1
CMD ["node", "--trace-warnings", "--no-warnings", "dist/server.js"]
