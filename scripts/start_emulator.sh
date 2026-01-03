#!/bin/bash
# CloudDev Android Emulator Startup Script
#
# This script starts the complete Android emulator stack:
# 1. Xvfb - Virtual X11 framebuffer
# 2. Openbox - Window manager
# 3. Android Emulator - The actual emulator
# 4. x11vnc - VNC server
# 5. noVNC/websockify - Web-based VNC client
#
# Configuration:
# - DISPLAY: X11 display number (default: :99)
# - VNC_PORT: VNC server port (default: 5900)
# - NOVNC_PORT: noVNC HTTP port (default: 6080)
# - AVD_NAME: Android Virtual Device name (default: first available)
# - SCREEN_RESOLUTION: Screen resolution (default: 1280x720x24)
#
# Usage:
#   ./start_emulator.sh
#   NOVNC_PORT=6081 AVD_NAME=Pixel_4_API_34 ./start_emulator.sh

set -e

# Configuration with defaults
DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
SCREEN_RESOLUTION="${SCREEN_RESOLUTION:-1280x720x24}"
NOVNC_PATH="${NOVNC_PATH:-/usr/share/novnc}"

# Android SDK PATH setup
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[CloudDev]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[CloudDev]${NC} $1"
}

log_error() {
    echo -e "${RED}[CloudDev]${NC} $1"
}

cleanup() {
    log_info "Cleaning up..."

    # Kill processes in reverse order
    if [ ! -z "$WEBSOCKIFY_PID" ]; then
        kill $WEBSOCKIFY_PID 2>/dev/null || true
    fi
    if [ ! -z "$VNC_PID" ]; then
        kill $VNC_PID 2>/dev/null || true
    fi
    if [ ! -z "$EMULATOR_PID" ]; then
        kill $EMULATOR_PID 2>/dev/null || true
    fi
    if [ ! -z "$WM_PID" ]; then
        kill $WM_PID 2>/dev/null || true
    fi
    if [ ! -z "$XVFB_PID" ]; then
        kill $XVFB_PID 2>/dev/null || true
    fi

    log_info "Cleanup complete"
}

trap cleanup EXIT

# Check required tools
check_requirements() {
    local missing=()

    command -v Xvfb >/dev/null 2>&1 || missing+=("Xvfb")
    command -v x11vnc >/dev/null 2>&1 || missing+=("x11vnc")
    command -v websockify >/dev/null 2>&1 || missing+=("websockify")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_error "Install with: apt-get install xvfb x11vnc websockify"
        exit 1
    fi

    # Check for Android SDK
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        log_warn "ANDROID_HOME or ANDROID_SDK_ROOT not set"
    fi
}

# Get the first available AVD or use provided name
get_avd_name() {
    if [ ! -z "$AVD_NAME" ]; then
        echo "$AVD_NAME"
        return
    fi

    # Try to get first AVD from emulator
    local avd=$(emulator -list-avds 2>/dev/null | head -1)
    if [ -z "$avd" ]; then
        log_error "No Android Virtual Devices found"
        log_error "Create one with: avdmanager create avd -n Pixel_4_API_34 -k 'system-images;android-34;google_apis;x86_64'"
        exit 1
    fi
    echo "$avd"
}

# Start Xvfb
start_xvfb() {
    log_info "Starting Xvfb on display $DISPLAY..."

    # Kill any existing Xvfb on this display
    pkill -f "Xvfb $DISPLAY" 2>/dev/null || true
    sleep 1

    Xvfb $DISPLAY -screen 0 $SCREEN_RESOLUTION &
    XVFB_PID=$!

    # Wait for Xvfb to start
    sleep 2

    if ! kill -0 $XVFB_PID 2>/dev/null; then
        log_error "Failed to start Xvfb"
        exit 1
    fi

    log_info "Xvfb started (PID: $XVFB_PID)"
}

# Start window manager
start_window_manager() {
    log_info "Starting window manager..."

    # Try openbox first, then fallback to others
    if command -v openbox >/dev/null 2>&1; then
        openbox &
        WM_PID=$!
    elif command -v fluxbox >/dev/null 2>&1; then
        fluxbox &
        WM_PID=$!
    else
        log_warn "No window manager found (openbox/fluxbox), continuing without"
        return
    fi

    sleep 1
    log_info "Window manager started (PID: $WM_PID)"
}

# Start Android emulator
start_emulator() {
    local avd_name=$(get_avd_name)
    log_info "Starting Android emulator: $avd_name..."

    # Start emulator with no-window (headless) but with GPU if available
    emulator -avd "$avd_name" \
        -no-audio \
        -no-boot-anim \
        -gpu swiftshader_indirect \
        -no-snapshot \
        -wipe-data \
        2>&1 &
    EMULATOR_PID=$!

    log_info "Waiting for emulator to boot..."

    # Wait for emulator to be ready (up to 120 seconds)
    local timeout=120
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            log_info "Emulator booted successfully!"
            return
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        echo -n "."
    done

    log_warn "Emulator may still be booting..."
}

# Start VNC server
start_vnc() {
    log_info "Starting x11vnc on port $VNC_PORT..."

    x11vnc -display $DISPLAY \
        -forever \
        -shared \
        -rfbport $VNC_PORT \
        -nopw \
        -xkb \
        2>&1 &
    VNC_PID=$!

    sleep 2

    if ! kill -0 $VNC_PID 2>/dev/null; then
        log_error "Failed to start x11vnc"
        exit 1
    fi

    log_info "VNC server started (PID: $VNC_PID)"
}

# Start noVNC/websockify
start_novnc() {
    log_info "Starting noVNC on port $NOVNC_PORT..."

    # Find noVNC path
    local novnc_path=""
    for path in "$NOVNC_PATH" "/usr/share/novnc" "/opt/novnc" "$HOME/novnc"; do
        if [ -d "$path" ]; then
            novnc_path="$path"
            break
        fi
    done

    if [ -z "$novnc_path" ]; then
        log_warn "noVNC not found, starting websockify only"
        websockify --web /usr/share/novnc $NOVNC_PORT localhost:$VNC_PORT &
    else
        websockify --web "$novnc_path" $NOVNC_PORT localhost:$VNC_PORT &
    fi
    WEBSOCKIFY_PID=$!

    sleep 2

    if ! kill -0 $WEBSOCKIFY_PID 2>/dev/null; then
        log_error "Failed to start websockify"
        exit 1
    fi

    log_info "noVNC started (PID: $WEBSOCKIFY_PID)"
    log_info ""
    log_info "============================================"
    log_info "  Android Emulator is ready!"
    log_info "  Access at: http://localhost:$NOVNC_PORT/vnc.html?autoconnect=1"
    log_info "============================================"
    log_info ""
}

# Main execution
main() {
    log_info "CloudDev Android Emulator Stack"
    log_info "================================"

    check_requirements
    start_xvfb
    start_window_manager
    start_emulator
    start_vnc
    start_novnc

    log_info "All services started. Press Ctrl+C to stop."

    # Keep script running
    wait
}

main "$@"
