#!/usr/bin/env bash
set -e
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
# Load .env if present
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi
exec uvicorn main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"