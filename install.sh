#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# GitHub repository details
REPO="tight-eng/pg_track_events"
LATEST_RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"

# Function to print error messages
error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

# Function to print success messages
success() {
    echo -e "${GREEN}$1${NC}"
}

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture to binary name
case $ARCH in
    "x86_64")
        ARCH="x64"
        ;;
    "aarch64"|"arm64")
        ARCH="arm64"
        ;;
    *)
        error "Unsupported architecture: $ARCH"
        ;;
esac

# Map OS to binary name
case $OS in
    "darwin")
        OS="darwin"
        ;;
    "linux")
        OS="linux"
        ;;
    "mingw"*|"msys"*|"cygwin"*)
        OS="windows"
        ;;
    *)
        error "Unsupported operating system: $OS"
        ;;
esac

# Determine binary name
if [ "$OS" = "windows" ]; then
    BINARY_NAME="pg_track_events-cli-${OS}-${ARCH}.exe"
else
    BINARY_NAME="pg_track_events-cli-${OS}-${ARCH}"
fi

# Get the latest release version
VERSION=$(curl -s $LATEST_RELEASE_URL | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$VERSION" ]; then
    error "Failed to fetch latest release version"
fi

# Download URL
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}"

# Determine installation directory
if [ "$OS" = "windows" ]; then
    INSTALL_DIR="$HOME/.local/bin"
else
    # Try to use /usr/local/bin first, fall back to ~/.local/bin if no permission
    if mkdir -p /usr/local/bin 2>/dev/null && [ -w /usr/local/bin ]; then
        INSTALL_DIR="/usr/local/bin"
    else
        INSTALL_DIR="$HOME/.local/bin"
    fi
fi

# Create directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download and install
echo "Downloading pg_track_events ${VERSION}..."
if ! curl -L -o "${INSTALL_DIR}/pg_track_events" "$DOWNLOAD_URL"; then
    error "Failed to download binary"
fi

# Make executable
chmod +x "${INSTALL_DIR}/pg_track_events"

# Remove quarantine attribute on macOS
if [ "$OS" = "darwin" ]; then
    xattr -d com.apple.quarantine "${INSTALL_DIR}/pg_track_events" 2>/dev/null || true
fi

success "Successfully installed pg_track_events ${VERSION} to ${INSTALL_DIR}/pg_track_events"
success "You can now run 'pg_track_events' from your terminal"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "To use pg_track_events, add this to your ~/.bashrc or ~/.zshrc and restart shell:"
    echo "export PATH=\"\$PATH:$INSTALL_DIR\""
fi

