#!/usr/bin/env bash
set -euo pipefail

if [ ! -d "$HOME/.cargo" ]; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
fi

source "$HOME/.cargo/env"
rustup default stable

PYTHON_VERSION="${PYTHON_VERSION:-3.11}"

if command -v mise >/dev/null 2>&1; then
  mise install "python@$PYTHON_VERSION"
  PYTHON_HOME="$(mise where "python@$PYTHON_VERSION")"
  export PATH="$PYTHON_HOME/bin:$PATH"
  hash -r
fi

python --version
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

npm ci
npm run build
