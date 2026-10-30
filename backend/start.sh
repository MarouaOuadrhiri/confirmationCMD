#!/bin/sh
# Cloud/demo boot: when no external database is configured, run the bundled
# MariaDB, create the app database/user, import the schema and seed the demo
# data (first boot only). Under docker-compose DB_HOST=mysql is set, so the
# bundled database is skipped and nothing below the marker runs.
if [ -z "$DB_HOST" ] || [ "$DB_HOST" = "127.0.0.1" ] || [ "$DB_HOST" = "localhost" ]; then
  export DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=mediast DB_PASSWORD=mediast DB_NAME=gestionCmdMdiast
  mkdir -p /run/mysqld
  chown mysql:mysql /run/mysqld
  if [ ! -d /var/lib/mysql/mysql ]; then
    mariadb-install-db --user=mysql --datadir=/var/lib/mysql --auth-root-authentication-method=normal >/dev/null 2>&1
  fi
  mysqld_safe --user=mysql &
  i=0
  while [ $i -lt 30 ]; do mysqladmin ping >/dev/null 2>&1 && break; i=$((i+1)); sleep 1; done
  mysql -u root -e "CREATE DATABASE IF NOT EXISTS gestionCmdMdiast CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'mediast'@'127.0.0.1' IDENTIFIED BY 'mediast'; CREATE USER IF NOT EXISTS 'mediast'@'localhost' IDENTIFIED BY 'mediast'; GRANT ALL PRIVILEGES ON gestionCmdMdiast.* TO 'mediast'@'127.0.0.1'; GRANT ALL PRIVILEGES ON gestionCmdMdiast.* TO 'mediast'@'localhost'; FLUSH PRIVILEGES;"
  TABLES=$(mysql -u root -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='gestionCmdMdiast';")
  echo "Bundled MariaDB up — tables in gestionCmdMdiast: $TABLES"
  if [ "$TABLES" = "0" ]; then
    mysql -u root < /app/database/schema.sql
    node database/seed.js || true
    node database/ensure_demo_accounts.js || true
    echo "Schema imported + demo data seeded"
  fi
fi
# --- marker: external-DB setups (docker-compose) continue from here ---
export JWT_SECRET=${JWT_SECRET:-mediast-demo-secret-change-me}
export NODE_ENV=production
export PORT=${PORT:-4000}
exec node src/index.js
