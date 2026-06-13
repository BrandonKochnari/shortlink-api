#!/usr/bin/env bash

set -e

echo "Running backend tests..."
if [ -x "./venv/bin/python" ]; then
  PYTHON="./venv/bin/python"
elif [ -x "./venv/Scripts/python.exe" ]; then
  PYTHON="./venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  PYTHON="python"
fi

"$PYTHON" -m pytest
