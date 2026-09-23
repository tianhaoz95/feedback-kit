# DevContainer for GitHub Codespaces

This directory configures a complete development environment for FeedbackKit's web application and CLI tooling in **GitHub Codespaces** and **VS Code Remote - Containers**.

## Included Dependencies & Tools

| Dependency | Purpose | Command | Notes |
|---|---|---|---|
| **Node.js & npm** | Runtime & package manager for Web & CLI | `node`, `npm`, `npx` | Node 22 (LTS) via DevContainer Feature |
| **Rust & Cargo** | Systems language & package manager | `rustc`, `cargo` | Latest stable Rust toolchain via DevContainer Feature |
| **Tauri CLI** | Desktop app packaging & development | `tauri`, `cargo tauri` | `@tauri-apps/cli` with WebKitGTK / system dependencies |
| **GitHub CLI** | GitHub repository & workflow interactions | `gh` | Pre-authenticated in GitHub Codespaces |
| **Supabase CLI** | Local Supabase backend & database | `supabase` | Docker-in-Docker enabled for `supabase start` |
| **Ollama** | Local LLM runtime & model server | `ollama` | Background daemon starts on port `11434` |
| **Antigravity CLI** | Google Antigravity agent CLI | `agy` | Installed to `/usr/local/bin/agy` |
| **Claude Code CLI** | Anthropic Claude Code agent CLI | `claude` | `@anthropic-ai/claude-code` |
| **Oh My Pi CLI** | Oh My Pi terminal coding agent | `omp` | `@oh-my-pi/pi-coding-agent` / prebuilt binary |

---

## Quickstart in Codespaces

### 1. Develop the Web App
```bash
cd web
npm run dev
```
The Vite development server runs on **port 3000** and will automatically open a browser preview.

To build and run tests:
```bash
cd web
npm run build
npm test
npm run lint
```

### 2. Local Supabase Backend (Optional)
Docker-in-Docker is preconfigured so you can run the local Supabase stack inside Codespaces:
```bash
supabase start
```
- API URL: `http://localhost:54321`
- Supabase Studio: `http://localhost:54323`
- DB URL: `postgresql://postgres:postgres@localhost:54322/postgres`

### 3. Ollama Local LLMs
The Ollama service is configured to automatically serve in the background (`http://127.0.0.1:11434`). You can pull and run models:
```bash
ollama pull llama3.2
ollama run llama3.2
```

### 4. AI Coding Agent CLIs
All requested AI coding agents are preinstalled:
- **Antigravity CLI**:
  ```bash
  agy
  ```
- **Claude Code**:
  ```bash
  claude
  ```
- **Oh My Pi**:
  ```bash
  omp
  ```

#### Preconfigured Convenience Aliases
Configured in `~/.bashrc`, `~/.zshrc`, and `/etc/bash.bashrc`:
- `ccyolo`: Runs `claude --dangerously-skip-permissions`
- `agyyolo`: Runs `agy --dangerously-skip-permissions`


### 5. Rust & Tauri
Tauri and its Linux build dependencies (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, etc.) are preinstalled:
```bash
tauri --help
cargo tauri --help
```

---

## Port Forwarding Reference

| Port | Description | Visibility |
|---|---|---|
| `3000` | Web App (Vite Dev Server) | Auto-opens in browser preview |
| `11434` | Ollama API | Internal / Localhost |
| `54321` | Supabase API | Internal / Localhost |
| `54322` | Supabase PostgreSQL Database | Internal / Localhost |
| `54323` | Supabase Studio | Notification / Browser link |
| `54324` | Supabase Inbucket (Mail) | Internal / Localhost |
