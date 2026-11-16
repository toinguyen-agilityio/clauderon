# The standard Pod image (POD-14): one container per Member on the Pod Host.
# Ubuntu LTS with git, gh, Node LTS, Python 3, build tools and the Claude Code
# CLI, running as the non-root user `pod` (uid 1000) who owns /workspace.
# CI builds it for linux/arm64 and linux/amd64 and pushes a date tag to GHCR.

ARG NODE_MAJOR=22
ARG CLAUDE_CODE_VERSION=2.1.325

# Node comes from the official image rather than a piped install script.
FROM node:${NODE_MAJOR}-bookworm-slim AS node

FROM ubuntu:24.04
ARG CLAUDE_CODE_VERSION

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git openssh-client \
      python3 python3-pip python3-venv \
      build-essential make jq unzip less procps tini \
 && install -d -m 0755 /etc/apt/keyrings \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends gh \
 && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
 && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && npm cache clean --force

# The "Open a pull request" Node's script (spec M1 §4.5).
COPY --chmod=0755 clauderon-open-pr /usr/local/bin/clauderon-open-pr

# Ubuntu images ship a user with uid 1000; replace it with `pod`.
RUN userdel --remove ubuntu 2>/dev/null || true \
 && useradd --create-home --uid 1000 --user-group --shell /bin/bash pod \
 && install -d -o pod -g pod /workspace

USER pod
WORKDIR /workspace
ENV HOME=/home/pod

# Kept running so the Host Agent can exec Nodes and terminals into it.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
