#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 Initializing FeedbackKit DevContainer..."
echo "=========================================="

# 1. Install global CLI tools via npm
echo "📦 Installing global CLI tools via npm..."
if npm install -g \
  supabase \
  @anthropic-ai/claude-code \
  @tauri-apps/cli \
  @oh-my-pi/pi-coding-agent 2>/dev/null; then
  echo "✓ Global npm CLI tools installed successfully."
else
  echo "Retrying global npm CLI tools install with sudo..."
  sudo npm install -g \
    supabase \
    @anthropic-ai/claude-code \
    @tauri-apps/cli \
    @oh-my-pi/pi-coding-agent
fi

# Ensure cargo-tauri alias is available if someone runs `cargo tauri`
if command -v tauri >/dev/null 2>&1 && ! command -v cargo-tauri >/dev/null 2>&1; then
  TAURI_BIN=$(command -v tauri)
  sudo ln -sf "$TAURI_BIN" /usr/local/bin/cargo-tauri 2>/dev/null || true
fi

# 2. Ensure Antigravity CLI (agy) is available
if ! command -v agy >/dev/null 2>&1; then
  echo "📥 Installing Antigravity CLI (agy)..."
  curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- -d /usr/local/bin || true
fi

# 3. Ensure Oh My Pi CLI (omp) is available
if ! command -v omp >/dev/null 2>&1; then
  echo "📥 Installing Oh My Pi CLI (omp)..."
  PI_INSTALL_DIR=/usr/local/bin curl -fsSL https://omp.sh/install | sh -s -- --binary || true
fi

# 4. Ensure Ollama is available
if ! command -v ollama >/dev/null 2>&1; then
  echo "📥 Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh || true
fi

# 5. Set up web app dependencies
if [ -d "web" ]; then
  echo "📦 Installing web workspace dependencies (npm)..."
  (cd web && npm install)

  # Create web/.env.local from example if not already present
  if [ ! -f "web/.env.local" ] && [ -f "web/.env.local.example" ]; then
    echo "⚙️ Creating web/.env.local from template..."
    cp web/.env.local.example web/.env.local
  fi
fi

# 6. Install root package dependencies (Skills scripts, etc.)
if [ -f "package.json" ]; then
  echo "📦 Installing root workspace dependencies..."
  npm install --ignore-scripts
fi

# 7. Configure shell aliases (ccyolo, agyyolo) in user shell rc files
echo "⚙️ Configuring shell aliases (ccyolo, agyyolo)..."
for RC_FILE in "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [ -f "$RC_FILE" ]; then
    if ! grep -q "ccyolo" "$RC_FILE" 2>/dev/null; then
      echo 'alias ccyolo="claude --dangerously-skip-permissions"' >> "$RC_FILE"
    fi
    if ! grep -q "agyyolo" "$RC_FILE" 2>/dev/null; then
      echo 'alias agyyolo="agy --dangerously-skip-permissions"' >> "$RC_FILE"
    fi
  fi
done


echo ""
echo "=========================================="
echo "✅ Environment Verification:"
echo "=========================================="
echo "Node.js:      $(node -v 2>/dev/null || echo 'not found')"
echo "npm:          $(npm -v 2>/dev/null || echo 'not found')"
echo "Rust:         $(rustc --version 2>/dev/null || echo 'not found')"
echo "Cargo:        $(cargo --version 2>/dev/null || echo 'not found')"
echo "Tauri CLI:    $(tauri --version 2>/dev/null || echo 'not found')"
echo "GitHub CLI:   $(gh --version 2>/dev/null | head -n 1 || echo 'not found')"
echo "Supabase:     $(supabase --version 2>/dev/null || echo 'not found')"
echo "Claude Code:  $(claude --version 2>/dev/null || echo 'not found')"
echo "Antigravity:  $(agy --version 2>/dev/null || which agy 2>/dev/null || echo 'installed at /usr/local/bin/agy')"
echo "Oh My Pi:     $(omp --version 2>/dev/null || which omp 2>/dev/null || echo 'installed at /usr/local/bin/omp')"
echo "Ollama:       $(ollama --version 2>/dev/null || echo 'not found')"
echo "=========================================="
echo ""
echo "🎉 Setup complete! To develop the web app:"
echo "   cd web && npm run dev"
echo ""
