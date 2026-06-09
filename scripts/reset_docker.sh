#!/usr/bin/env bash

set -e

echo "Stopping containers and removing volumes..."
docker compose down -v

echo "Rebuilding and starting containers..."
docker compose up --build