#!/bin/bash
#
# Publish Devbox Cloud Tools to VS Code Marketplace and Open VSX Registry
#
# Usage:
#   ./scripts/publish.sh                    # Interactive mode
#   ./scripts/publish.sh --vsce-only        # VS Code Marketplace only
#   ./scripts/publish.sh --ovsx-only        # Open VSX only
#
# Environment variables (optional):
#   VSCE_PAT     - VS Code Marketplace Personal Access Token
#   OVSX_PAT     - Open VSX Registry Personal Access Token
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}!${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_step() { echo -e "${BLUE}→${NC} $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}   📦 Devbox Cloud Tools - Publisher          ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
PUBLISH_VSCE=true
PUBLISH_OVSX=true

for arg in "$@"; do
    case $arg in
        --vsce-only) PUBLISH_OVSX=false ;;
        --ovsx-only) PUBLISH_VSCE=false ;;
        --help)
            echo "Usage: $0 [--vsce-only|--ovsx-only]"
            echo ""
            echo "Options:"
            echo "  --vsce-only   Publish only to VS Code Marketplace"
            echo "  --ovsx-only   Publish only to Open VSX Registry"
            echo ""
            echo "Environment variables:"
            echo "  VSCE_PAT      VS Code Marketplace token"
            echo "  OVSX_PAT      Open VSX Registry token"
            exit 0
            ;;
    esac
done

# Check for required tools
log_step "Checking dependencies..."

if ! command -v npx &> /dev/null; then
    log_error "npx not found. Please install Node.js"
    exit 1
fi

# Install ovsx if needed and publishing to Open VSX
if $PUBLISH_OVSX && ! command -v ovsx &> /dev/null; then
    log_step "Installing ovsx CLI..."
    npm install -g ovsx
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
VSIX_FILE="${NAME}-${VERSION}.vsix"

log_info "Package: $NAME v$VERSION"

# Build and package
log_step "Building extension..."
npm run compile

log_step "Packaging extension..."
npx vsce package

if [ ! -f "$VSIX_FILE" ]; then
    log_error "VSIX file not found: $VSIX_FILE"
    exit 1
fi

log_info "Created: $VSIX_FILE"
echo ""

# Publish to VS Code Marketplace
if $PUBLISH_VSCE; then
    echo -e "${BLUE}── VS Code Marketplace ──${NC}"
    
    if [ -z "$VSCE_PAT" ]; then
        echo ""
        echo "Get your token from: https://dev.azure.com → Personal Access Tokens"
        echo "Scopes needed: Marketplace > Manage"
        echo ""
        read -sp "Enter VS Code Marketplace PAT (or press Enter to skip): " VSCE_PAT
        echo ""
    fi
    
    if [ -n "$VSCE_PAT" ]; then
        log_step "Publishing to VS Code Marketplace..."
        if npx vsce publish -p "$VSCE_PAT"; then
            log_info "Published to VS Code Marketplace!"
            echo "    https://marketplace.visualstudio.com/items?itemName=melivo.$NAME"
        else
            log_error "Failed to publish to VS Code Marketplace"
        fi
    else
        log_warn "Skipped VS Code Marketplace"
    fi
    echo ""
fi

# Publish to Open VSX
if $PUBLISH_OVSX; then
    echo -e "${BLUE}── Open VSX Registry ──${NC}"
    
    if [ -z "$OVSX_PAT" ]; then
        echo ""
        echo "Get your token from: https://open-vsx.org → Settings → Access Tokens"
        echo ""
        read -sp "Enter Open VSX PAT (or press Enter to skip): " OVSX_PAT
        echo ""
    fi
    
    if [ -n "$OVSX_PAT" ]; then
        log_step "Publishing to Open VSX Registry..."
        if ovsx publish "$VSIX_FILE" -p "$OVSX_PAT"; then
            log_info "Published to Open VSX Registry!"
            echo "    https://open-vsx.org/extension/melivo/$NAME"
        else
            log_error "Failed to publish to Open VSX"
        fi
    else
        log_warn "Skipped Open VSX Registry"
    fi
    echo ""
fi

echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}   🎉 Publishing complete!                    ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
