#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$POSTGRES_APP_PASSWORD" --set=ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE mobiflow_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE mobiflow TO mobiflow_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mobiflow_app;
SQL
