# The standard Pod image: one container per Member on the Pod Host (POD-2).
# Ubuntu with git, gh, Node LTS, Python 3, build tools and the Claude Code CLI.
# Build for arm64 and amd64; see .github/workflows/pod-image.yml.
FROM ubuntu:24.04

ARG NODE_MAJOR=22
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git openssh-client build-essential \
      python3 python3-pip python3-venv jq less unzip sudo locales \
 && locale-gen en_US.UTF-8 \
 && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8

# GitHub CLI from the official apt repository.
RUN mkdir -p -m 755 /etc/apt/keyrings \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends gh \
 && rm -rf /var/lib/apt/lists/*

# Node LTS from NodeSource, then the Claude Code CLI.
RUN curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g @anthropic-ai/claude-code \
 && npm cache clean --force

# The Member works as a normal user. /workspace is the Pod's Workspace volume:
# it holds the Claude Code and gh logins, one clone per Project and one
# worktree per Run, and survives Stop and Recreate (POD-10).
RUN useradd --create-home --home-dir /workspace --shell /bin/bash member
USER member
WORKDIR /workspace
VOLUME ["/workspace"]

# The Host Agent runs Nodes and the web terminal with `docker exec`.
CMD ["sleep", "infinity"]
