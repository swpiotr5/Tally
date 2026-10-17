#!/bin/sh
# Runs once, on the first start of an empty data volume.
# Creates a separate database for pytest next to the main one.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE "${POSTGRES_DB}_test";
EOSQL
