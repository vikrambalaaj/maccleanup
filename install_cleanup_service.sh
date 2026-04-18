#!/usr/bin/env bash
# =============================================================================
# install_cleanup_service.sh
# One-command installer for the Mac System Cleanup service
#
# Usage:
#   sudo bash install_cleanup_service.sh           # install
#   sudo bash install_cleanup_service.sh --remove  # uninstall
#   sudo bash install_cleanup_service.sh --status  # check status
#   sudo bash install_cleanup_service.sh --run-now # trigger immediately
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Mode Selection ────────────────────────────────────────────────────────────
MODE="system"
for arg in "$@"; do
    if [[ "$arg" == "--user" ]]; then
        MODE="user"
        break
    fi
done

SCRIPT_SRC="./mac_cleanup.sh"
if [[ "$MODE" == "user" ]]; then
    info "Running in USER mode (Installation to $HOME)"
    SCRIPT_DEST="$HOME/bin/mac_cleanup.sh"
    PLIST_DEST="$HOME/Library/LaunchAgents/com.macsystem.cleanup.plist"
    PLIST_SRC="./com.macsystem.cleanup.user.plist"
    LOG_DIR="$HOME/Library/Logs/mac_cleanup"
    LABEL="com.macsystem.cleanup"
else
    SCRIPT_DEST="/usr/local/bin/mac_cleanup.sh"
    PLIST_DEST="/Library/LaunchDaemons/com.macsystem.cleanup.plist"
    PLIST_SRC="./com.macsystem.cleanup.plist"
    LABEL="com.macsystem.cleanup"
    LOG_DIR="/var/log/mac_cleanup"
fi


info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

check_root() {
    if [[ "$MODE" == "system" ]]; then
        [[ $EUID -ne 0 ]] && error "Please run as root: sudo bash $0"
    fi
}

install_service() {
    check_root
    echo ""
    echo -e "${BOLD}Installing Mac System Cleanup (${MODE} mode)${NC}"
    echo "══════════════════════════════════════════════════"

    # Validate source files exist
    [[ ! -f "$SCRIPT_SRC" ]] && error "Cannot find $SCRIPT_SRC — run from the same directory"
    [[ ! -f "$PLIST_SRC" ]]  && error "Cannot find $PLIST_SRC — run from the same directory"

    # Create log directory
    mkdir -p "$LOG_DIR"
    chmod 750 "$LOG_DIR"
    info "Created log directory: $LOG_DIR"

    # Install cleanup script
    mkdir -p "$(dirname "$SCRIPT_DEST")"
    cp "$SCRIPT_SRC" "$SCRIPT_DEST"
    chmod 755 "$SCRIPT_DEST"
    if [[ "$MODE" == "system" ]]; then
        chown root:wheel "$SCRIPT_DEST"
    fi
    success "Installed script to: $SCRIPT_DEST"

    # Unload existing daemon if present
    if launchctl list "$LABEL" &>/dev/null 2>&1; then
        warn "Existing service found — unloading first"
        launchctl unload "$PLIST_DEST" 2>/dev/null || true
    fi

    # Install plist
    cp "$PLIST_SRC" "$PLIST_DEST"
    chmod 644 "$PLIST_DEST"
    if [[ "$MODE" == "system" ]]; then
        chown root:wheel "$PLIST_DEST"
    fi
    success "Installed plist to: $PLIST_DEST"

    # Load and enable daemon
    launchctl load -w "$PLIST_DEST"
    success "LaunchDaemon loaded and enabled"

    # Verify
    if launchctl list "$LABEL" &>/dev/null 2>&1; then
        success "Service is running ✓"
    else
        warn "Service loaded but not yet listed — this is normal (runs at 3 AM)"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}Installation complete!${NC}"
    echo ""
    echo "  Runs daily at: 3:00 AM"
    echo "  Logs at      : $LOG_DIR"
    if [[ "$MODE" == "system" ]]; then
        echo "  Dry run      : sudo mac_cleanup.sh --dry-run"
        echo "  Run now      : sudo bash $0 --run-now"
        echo "  Status       : sudo bash $0 --status"
    else
        echo "  Dry run      : mac_cleanup.sh --dry-run"
        echo "  Run now      : bash $0 --run-now --user"
        echo "  Status       : bash $0 --status --user"
    fi
    echo ""
}

remove_service() {
    check_root
    echo ""
    info "Removing Mac System Cleanup Service..."

    if launchctl list "$LABEL" &>/dev/null 2>&1; then
        launchctl unload -w "$PLIST_DEST" 2>/dev/null || true
        success "Service unloaded"
    else
        warn "Service was not loaded"
    fi

    [[ -f "$PLIST_DEST" ]]  && { rm -f "$PLIST_DEST";  success "Removed: $PLIST_DEST"; }
    [[ -f "$SCRIPT_DEST" ]] && { rm -f "$SCRIPT_DEST"; success "Removed: $SCRIPT_DEST"; }

    echo ""
    echo -e "${GREEN}Service removed.${NC} Logs are kept at: $LOG_DIR"
    echo "To also remove logs: sudo rm -rf $LOG_DIR"
    echo ""
}

show_status() {
    echo ""
    echo -e "${BOLD}Mac Cleanup Service Status${NC}"
    echo "══════════════════════════════"

    # Daemon status
    if launchctl list "$LABEL" &>/dev/null 2>&1; then
        echo -e "Service       : ${GREEN}Loaded${NC}"
        launchctl list "$LABEL" 2>/dev/null
    else
        echo -e "Service       : ${YELLOW}Not loaded${NC}"
    fi

    # Files
    echo ""
    echo "Script        : $( [[ -f $SCRIPT_DEST ]] && echo -e "${GREEN}Installed${NC}" || echo -e "${RED}Missing${NC}" )"
    echo "Plist         : $( [[ -f $PLIST_DEST  ]] && echo -e "${GREEN}Installed${NC}" || echo -e "${RED}Missing${NC}" )"
    echo "Log dir       : $( [[ -d $LOG_DIR     ]] && echo -e "${GREEN}Exists${NC}"    || echo -e "${RED}Missing${NC}" )"

    # Latest report
    if [[ -f "${LOG_DIR}/latest_report.txt" ]]; then
        echo ""
        echo -e "${BOLD}Latest Cleanup Report:${NC}"
        cat "${LOG_DIR}/latest_report.txt"
    fi

    # Disk space
    echo ""
    echo -e "${BOLD}Current Disk Usage:${NC}"
    df -h / | awk 'NR==1 || NR==2'
    echo ""
}

run_now() {
    check_root
    info "Triggering cleanup now (you can watch the log with: tail -f $LOG_DIR/launchd_stdout.log)"
    launchctl start "$LABEL" 2>/dev/null || {
        info "launchctl start failed — running script directly"
        bash "$SCRIPT_DEST"
    }
    success "Cleanup triggered"
}

# ── Entry point ───────────────────────────────────────────────────────────────
case "${1:-install}" in
    --remove|remove)    remove_service ;;
    --status|status)    show_status ;;
    --run-now|run-now)  run_now ;;
    --install|install)  install_service ;;
    *)                  install_service ;;
esac
