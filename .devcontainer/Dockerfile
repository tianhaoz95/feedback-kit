FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install system prerequisites, build essentials, and Tauri v2 Linux dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    wget \
    file \
    git \
    zstd \
    jq \
    pkg-config \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libwebkit2gtk-4.1-dev \
    libxdo-dev \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh || true

# 3. Install Antigravity CLI (agy)
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- -d /usr/local/bin || true

# 4. Install Oh My Pi CLI (omp) prebuilt binary
RUN PI_INSTALL_DIR=/usr/local/bin curl -fsSL https://omp.sh/install | sh -s -- --binary || true

# Default Ollama host configuration to listen across container boundaries
ENV OLLAMA_HOST=0.0.0.0:11434

# Configure convenient shell aliases for AI CLIs
RUN echo 'alias ccyolo="claude --dangerously-skip-permissions"' >> /etc/bash.bashrc && \
    echo 'alias agyyolo="agy --dangerously-skip-permissions"' >> /etc/bash.bashrc && \
    mkdir -p /etc/profile.d && \
    echo 'alias ccyolo="claude --dangerously-skip-permissions"' >> /etc/profile.d/00-aliases.sh && \
    echo 'alias agyyolo="agy --dangerously-skip-permissions"' >> /etc/profile.d/00-aliases.sh

