FROM node:20-alpine

WORKDIR /app

COPY services/config-service/package*.json ./services/config-service/
COPY shared ./shared

WORKDIR /app/services/config-service
RUN npm ci --omit=dev

COPY services/config-service ./

EXPOSE 3008

CMD ["npm", "start"]
