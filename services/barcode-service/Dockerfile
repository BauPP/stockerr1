FROM node:20-alpine

WORKDIR /app

COPY services/barcode-service/package*.json ./services/barcode-service/
COPY shared ./shared

WORKDIR /app/services/barcode-service
RUN npm ci --omit=dev

COPY services/barcode-service ./

EXPOSE 3007

CMD ["npm", "start"]
