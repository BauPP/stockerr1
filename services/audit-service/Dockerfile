FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/audit-service ./services/audit-service
COPY shared ./shared

WORKDIR /app/services/audit-service

EXPOSE 3006

CMD ["npm", "start"]
