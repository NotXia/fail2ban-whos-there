FROM node:22

LABEL org.opencontainers.image.source=https://github.com/NotXia/fail2ban-whos-there
LABEL org.opencontainers.image.description="fail2ban map and monitoring dashboard"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app
COPY . .
RUN npm install

CMD ["npx", "tsx", "./src/index.ts"]