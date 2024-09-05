FROM node:22

WORKDIR /app
COPY . .
RUN npm install

CMD ["npx", "tsx", "./src/index.ts"]