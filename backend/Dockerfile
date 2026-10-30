# ==============================================================================
# Mediast Backend API — self-contained deploy image (Node.js 20 + MariaDB)
# ==============================================================================
# Used by BOTH docker-compose and the SnapDeploy cloud demo:
#  - docker-compose sets DB_HOST=mysql -> start.sh skips the bundled database
#    and the API uses the compose MySQL service, exactly as before.
#  - With no DB_* environment (SnapDeploy), start.sh boots the bundled
#    MariaDB, imports database/schema.sql and seeds the demo data once.
FROM node:20-bookworm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apt-get update && apt-get install -y --no-install-recommends mariadb-server mariadb-client && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN chmod +x start.sh

EXPOSE 4000

CMD ["./start.sh"]
