# Toolchain for building the Tauri demo on Linux (WebKitGTK) and running its
# end-to-end self-test under a virtual display. Sources are mounted at run
# time and build output lives in named volumes — see run-linux.sh.
FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev build-essential curl file libxdo-dev libssl-dev \
      libayatana-appindicator3-dev librsvg2-dev xvfb xauth dbus-x11 rsync \
    && rm -rf /var/lib/apt/lists/*
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH=/root/.cargo/bin:$PATH
WORKDIR /repo
