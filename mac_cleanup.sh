#!/usr/bin/env bash
# =============================================================================
# mac_cleanup.sh — Safe macOS System Data Cleanup Script
# Runs as a daily LaunchDaemon service
# Version: 2.5
# =============================================================================

set -euo pipefail

# ── Runtime state ─────────────────────────────────────────────────────────────
IS_ROOT=false
[[ $EUID -eq 0 ]] && IS_ROOT=true

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_VERSION="2.5"

if [[ "$IS_ROOT" == "true" ]]; then
    LOG_DIR="/var/log/mac_cleanup"
else
    LOG_DIR="$HOME/Library/Logs/mac_cleanup"
fi

LOG_FILE="${LOG_DIR}/cleanup_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="${LOG_DIR}/latest_report.txt"

# Age thresholds (in days)
CACHE_MAX_AGE=7
LOG_MAX_AGE=14
TEMP_MAX_AGE=3
CRASH_MAX_AGE=30
XCODE_DERIVED_AGE=14
NPM_MAX_AGE=30
PIP_MAX_AGE=30
BREW_MAX_AGE=30
DOCKER_PRUNE_AGE=720h

MAX_LOG_RETAIN=30

# ── Dry-run mode ──────────────────────────────────────────────────────────────
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# ── Runtime state ─────────────────────────────────────────────────────────────
TOTAL_FREED_BYTES=0
START_TIME=$(date +%s)
ERRORS=()

# ── Setup logging ─────────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
chmod 750 "${LOG_DIR}"

exec > >(tee -a "${LOG_FILE}") 2>&1

log()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
warn()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
error()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*"; ERRORS+=("$*"); }
section(){ echo ""; echo "══════════════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════════════"; }

# ── Utility: measure directory size in bytes ──────────────────────────────────
dir_size_bytes() {
    local path="$1"
    if [[ -d "$path" ]]; then
        local size
        size=$(du -sk "$path" 2>/dev/null | tail -n 1 | awk '{print $1 * 1024}') || size=0
        echo "${size:-0}"
    else
        echo 0
    fi
}

# ── Utility: human-readable bytes ────────────────────────────────────────────
human_readable() {
    local bytes=$1
    if   (( bytes >= 1073741824 )); then printf "%.2f GB" "$(echo "scale=2; $bytes/1073741824" | bc)"
    elif (( bytes >= 1048576 ));    then printf "%.2f MB" "$(echo "scale=2; $bytes/1048576" | bc)"
    elif (( bytes >= 1024 ));       then printf "%.1f KB" "$(echo "scale=1; $bytes/1024" | bc)"
    else printf "%d B" "$bytes"
    fi
}

# ── Utility: safe delete with tracking ───────────────────────────────────────
safe_delete() {
    local target="$1"
    local min_age="${2:-0}"
    local recursive="${3:-}"

    local BLOCKLIST=(
        "/System" "/usr/bin" "/usr/sbin" "/usr/libexec"
        "/sbin" "/bin" "/etc" "/Library/Preferences"
        "/Library/Application Support/Apple"
        "/private/etc" "/private/var/db"
        "/Applications" "/Developer"
        "/Library/LaunchAgents" "/Library/LaunchDaemons"
        "/System/Library"
    )

    for blocked in "${BLOCKLIST[@]}"; do
        if [[ "$target" == "$blocked"* ]]; then
            warn "Blocked: '$target' matches protected path '$blocked' — skipping"
            return 0
        fi
    done

    if [[ ! -e "$target" && ! -d "$target" ]]; then return 0; fi

    local before_bytes
    before_bytes=$(dir_size_bytes "$target")

    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] Would clean: $target ($(human_readable $before_bytes), age filter: ${min_age}d)"
        TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + before_bytes ))
        return 0
    fi

    if [[ -d "$target" && -n "$recursive" ]]; then
        if (( min_age > 0 )); then
            find "$target" -mindepth 1 -maxdepth 3 \( -type f -o -type d \) -mtime "+${min_age}" ! -newer /tmp -delete 2>/dev/null || true
        else
            find "$target" -mindepth 1 -maxdepth 3 -mtime "+0" -delete 2>/dev/null || true
        fi
    elif [[ -f "$target" ]]; then
        rm -f "$target" 2>/dev/null || warn "Could not remove file: $target"
    fi

    local after_bytes=$(dir_size_bytes "$target")
    local freed=$(( before_bytes - after_bytes ))
    if (( freed > 0 )); then
        TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
        log "Freed $(human_readable $freed) from: $target"
    fi
}

# ── Helper: Iterate over valid user homes ──────────────────────────────────────
foreach_user_home() {
    local callback="$1"
    if [[ "$IS_ROOT" == "true" ]]; then
        while read -r username homedir; do
            if [[ -z "$username" || -z "$homedir" ]]; then continue; fi
            if [[ ! -d "$homedir" ]]; then continue; fi
            "$callback" "$username" "$homedir"
        done < <(dscl . -list /Users NFSHomeDirectory | awk '$2 ~ /^\/Users/ {print $1, $2}')
    else
        "$callback" "$USER" "$HOME"
    fi
}

# ── Utility: run a command with logging ──────────────────────────────────────
safe_run() {
    local desc="$1"; shift
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] Would run: $*"
        return 0
    fi
    log "Running: $desc"
    "$@" 2>/dev/null || warn "Command failed (non-fatal): $*"
}

# ═════════════════════════════════════════════════════════════════════════════
#  CLEANUP FUNCTIONS
# ═════════════════════════════════════════════════════════════════════════════

clean_user_cache_per_user() {
    local username="$1"; local homedir="$2"
    log "Processing caches for user: $username ($homedir)"
    local cache_dir="$homedir/Library/Caches"
    if [[ ! -d "$cache_dir" ]]; then return 0; fi

    local SAFE_CACHE_DIRS=("com.apple.Safari" "com.google.Chrome" "org.mozilla.firefox" "com.microsoft.VSCode" "com.apple.dt.Xcode" "com.apple.Music" "CloudKit" "com.apple.WebKit" "pip" "com.apple.Mail" "Google" "com.microsoft.autoupdate.fba")
    for subdir in "${SAFE_CACHE_DIRS[@]}"; do
        safe_delete "${cache_dir}/${subdir}" "$CACHE_MAX_AGE" "--recursive"
    done

    local before=$(dir_size_bytes "$cache_dir")
    if [[ "$DRY_RUN" != "true" ]]; then
        find "$cache_dir" -mindepth 2 -maxdepth 4 -type f -mtime "+${CACHE_MAX_AGE}" -not -path "*/KeychainCircle/*" -not -path "*/com.apple.security/*" -not -path "*/com.apple.iTunesStore/*" -delete 2>/dev/null || true
    fi
    local after=$(dir_size_bytes "$cache_dir")
    local freed=$(( before - after ))
    if (( freed > 0 )); then
        TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
        log "Freed $(human_readable $freed) from general caches for: $username"
    fi

    # Chrome & Comet Internal Caches (requested by user)
    local CHROME_LIKE_APPS=("Google/Chrome" "Comet")
    for app_path in "${CHROME_LIKE_APPS[@]}"; do
        local app_support="${homedir}/Library/Application Support/${app_path}"
        if [[ -d "$app_support" ]]; then
            log "Cleaning $app_path caches for $username"
            
            # 1. Global App Support Caches
            local GLOBAL_CACHES=("ShaderCache" "GraphiteDawnCache" "extensions_crx_cache" "component_crx_cache")
            for gc in "${GLOBAL_CACHES[@]}"; do
                safe_delete "${app_support}/${gc}" 0 "--recursive"
            done

            # 2. Profile-specific Caches (Default, Profile 1, etc.)
            for profile in "$app_support"/*/ ; do
                # Ignore directories that are not profiles if any
                if [[ -d "${profile}Cache" ]]; then safe_delete "${profile}Cache" 0 "--recursive"; fi
                if [[ -d "${profile}Code Cache" ]]; then safe_delete "${profile}Code Cache" 0 "--recursive"; fi
                if [[ -d "${profile}GPUCache" ]]; then safe_delete "${profile}GPUCache" 0 "--recursive"; fi
            done
        fi
    done

    # WebKit & HTTPStorages (requested by user)
    safe_delete "${homedir}/Library/WebKit" 0 "--recursive"
    safe_delete "${homedir}/Library/HTTPStorages" 0 "--recursive"
}

clean_darwin_cache_per_user() {
    local username="$1"; local homedir="$2"
    local darwin_cache_dir
    
    if [[ "$IS_ROOT" == "true" ]]; then
        darwin_cache_dir=$(sudo -u "$username" getconf DARWIN_USER_CACHE_DIR 2>/dev/null || echo "")
    else
        darwin_cache_dir=$(getconf DARWIN_USER_CACHE_DIR 2>/dev/null || echo "")
    fi

    if [[ -n "$darwin_cache_dir" && -d "$darwin_cache_dir" ]]; then
        log "Cleaning Darwin user cache for $username: $darwin_cache_dir"
        safe_delete "$darwin_cache_dir" 0 "--recursive"
    fi
}

clean_user_caches() {
    section "1. User Caches (~/Library/Caches & Darwin)"
    foreach_user_home clean_user_cache_per_user
    foreach_user_home clean_darwin_cache_per_user
}

clean_system_logs() {
    section "2. System Logs"
    if [[ -d /var/log ]]; then
        local before=$(dir_size_bytes /var/log)
        if [[ "$DRY_RUN" != "true" ]]; then
            find /var/log -type f \( -name "*.log" -o -name "*.log.*" \) -mtime "+${LOG_MAX_AGE}" -not -name "install.log" -delete 2>/dev/null || true
            find /var/log -type f -name "*.log" -size +50M -not -name "*.gz" -exec gzip -9 {} \; 2>/dev/null || true
        fi
        local after=$(dir_size_bytes /var/log)
        local freed=$(( before - after ))
        if (( freed > 0 )); then
            TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
            log "Freed $(human_readable $freed) from /var/log"
        fi
    fi
    if [[ "$DRY_RUN" != "true" ]]; then
        safe_run "ASL log pruning" /usr/sbin/aslmanager -s /var/log/asl
    else
        log "[DRY-RUN] Would run: aslmanager -s /var/log/asl"
    fi
    safe_delete "/private/var/log" "$LOG_MAX_AGE" "--recursive"
}

clean_temp_files() {
    section "3. Temporary Files"
    if [[ -d /tmp ]]; then
        local before=$(dir_size_bytes /tmp)
        if [[ "$DRY_RUN" != "true" ]]; then
            find /tmp -mindepth 1 -maxdepth 2 -type f -mtime "+${TEMP_MAX_AGE}" -delete 2>/dev/null || true
            find /tmp -mindepth 1 -maxdepth 2 -type d -empty -mtime "+${TEMP_MAX_AGE}" -delete 2>/dev/null || true
        fi
        local after=$(dir_size_bytes /tmp)
        local freed=$(( before - after ))
        if (( freed > 0 )); then
            TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
            log "Freed $(human_readable $freed) from /tmp"
        fi
    fi
    if [[ -d /private/tmp ]]; then
        local before=$(dir_size_bytes /private/tmp)
        if [[ "$DRY_RUN" != "true" ]]; then
            find /private/tmp -mindepth 1 -maxdepth 2 -type f -mtime "+${TEMP_MAX_AGE}" -not -name "*.sock" -delete 2>/dev/null || true
        fi
        local after=$(dir_size_bytes /private/tmp)
        local freed=$(( before - after ))
        if (( freed > 0 )); then
            TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
            log "Freed $(human_readable $freed) from /private/tmp"
        fi
    fi
}

clean_crash_reports_per_user() {
    local username="$1"; local homedir="$2"
    safe_delete "$homedir/Library/Logs/DiagnosticReports" "$CRASH_MAX_AGE" "--recursive"
    safe_delete "$homedir/Library/Logs/CrashReporter" "$CRASH_MAX_AGE" "--recursive"
    safe_delete "$homedir/Library/Logs/HangReporter" "$CRASH_MAX_AGE" "--recursive"
}

clean_crash_reports() {
    section "4. Crash Reports & Diagnostics"
    if [[ "$IS_ROOT" == "true" ]]; then
        foreach_user_home clean_crash_reports_per_user
        safe_delete "/Library/Logs/DiagnosticReports" "$CRASH_MAX_AGE" "--recursive"
    else
        log "Processing crash reports and logs for current user: $USER"
        safe_delete "$HOME/Library/Logs" "$CRASH_MAX_AGE" "--recursive"
        safe_delete "$HOME/Library/Logs/DiagnosticReports" "$CRASH_MAX_AGE" "--recursive"
    fi
}

clean_xcode_per_user() {
    local username="$1"; local homedir="$2"
    local xcode_dd="$homedir/Library/Developer/Xcode/DerivedData"
    local sim_cache="$homedir/Library/Developer/CoreSimulator/Caches"
    local ios_device="$homedir/Library/Developer/Xcode/iOS DeviceSupport"
    local xcode_cache="$homedir/Library/Caches/com.apple.dt.Xcode"

    # 1. Xcode DerivedData (Aggressive)
    if [[ -d "$xcode_dd" ]]; then
        local before=$(dir_size_bytes "$xcode_dd")
        if [[ "$DRY_RUN" != "true" ]]; then
            # The user requested clearing all DerivedData
            find "$xcode_dd" -mindepth 1 -maxdepth 1 -exec rm -rf {} \; 2>/dev/null || true
        else
            log "[DRY-RUN] Would clear all Xcode DerivedData: $xcode_dd"
        fi
        local after=$(dir_size_bytes "$xcode_dd")
        local freed=$(( before - after ))
        if (( freed > 0 )); then
            TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
            log "Freed $(human_readable $freed) from Xcode DerivedData ($username)"
        fi
    fi

    # 2. CoreSimulator Caches
    if [[ -d "$sim_cache" ]]; then
        local before=$(dir_size_bytes "$sim_cache")
        if [[ "$DRY_RUN" != "true" ]]; then
            find "$sim_cache" -mindepth 1 -maxdepth 1 -exec rm -rf {} \; 2>/dev/null || true
        else
            log "[DRY-RUN] Would clear CoreSimulator Caches: $sim_cache"
        fi
        local after=$(dir_size_bytes "$sim_cache")
        local freed=$(( before - after ))
        if (( freed > 0 )); then
            TOTAL_FREED_BYTES=$(( TOTAL_FREED_BYTES + freed ))
            log "Freed $(human_readable $freed) from CoreSimulator Caches ($username)"
        fi
    fi

    safe_delete "$xcode_cache" "$XCODE_DERIVED_AGE" "--recursive"
    if [[ -d "$ios_device" ]]; then
        local ios_count=$(ls -1 "$ios_device" 2>/dev/null | wc -l | tr -d ' ')
        if (( ios_count > 4 )); then
            if [[ "$DRY_RUN" != "true" ]]; then
                ls -1t "$ios_device" 2>/dev/null | tail -n +5 | xargs -I{} rm -rf "$ios_device/{}" 2>/dev/null || true
            fi
        fi
    fi
    if command -v xcrun &>/dev/null && [[ "$DRY_RUN" != "true" ]]; then
        xcrun simctl delete unavailable 2>/dev/null || true
    fi
}

clean_xcode() {
    section "5. Xcode Build Artifacts"
    foreach_user_home clean_xcode_per_user
}

clean_pip_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/.cache/pip" ]]; then 
        if [[ "$DRY_RUN" != "true" ]]; then
            if [[ "$IS_ROOT" == "true" ]]; then
                sudo -u "$username" pip cache purge 2>/dev/null || true
            else
                pip cache purge 2>/dev/null || true
            fi
        fi
        safe_delete "$homedir/.cache/pip" "$PIP_MAX_AGE" "--recursive"
    fi
    
    # Python site-packages dist-info cleanup (requested by user)
    # Target: ~/Library/Python/*/lib/python/site-packages/*.dist-info
    if [[ "$DRY_RUN" != "true" ]]; then
        find "$homedir/Library/Python" -name "*.dist-info" -path "*/site-packages/*" -type d -exec rm -rf {} \; 2>/dev/null || true
    else
        log "[DRY-RUN] Would clean Python dist-info in $homedir/Library/Python"
    fi
}

clean_conda_per_user() {
    local username="$1"; local homedir="$2"
    # Check if conda is installed for the user (usually in ~/opt/anaconda3, ~/anaconda3, or ~/miniconda3)
    # But easiest is to just try running it via sudo -u
    if [[ "$DRY_RUN" != "true" ]]; then
        if [[ "$IS_ROOT" == "true" ]]; then
            sudo -u "$username" bash -c "command -v conda &>/dev/null && conda clean --all -y" 2>/dev/null || true
        else
            command -v conda &>/dev/null && conda clean --all -y 2>/dev/null || true
        fi
    else
        log "[DRY-RUN] Would run conda clean --all -y for $username"
    fi
}

clean_yarn_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/.yarn/berry/cache" ]]; then safe_delete "$homedir/.yarn/berry/cache" "$NPM_MAX_AGE" "--recursive"; fi
    if [[ -d "$homedir/.cache/yarn" ]]; then safe_delete "$homedir/.cache/yarn" "$NPM_MAX_AGE" "--recursive"; fi
}
clean_cocoapods_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/Library/Caches/CocoaPods" ]]; then safe_delete "$homedir/Library/Caches/CocoaPods" "$BREW_MAX_AGE" "--recursive"; fi
}
clean_gradle_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/.gradle/caches" ]]; then safe_delete "$homedir/.gradle/caches" "$NPM_MAX_AGE" "--recursive"; fi
}
clean_nuget_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/.nuget" ]]; then safe_delete "$homedir/.nuget" "$NPM_MAX_AGE" "--recursive"; fi
}

clean_package_caches() {
    section "6. Package Manager Caches"
    if command -v brew &>/dev/null; then
        local brew_cache=$(brew --cache 2>/dev/null || echo "")
        if [[ -n "$brew_cache" && -d "$brew_cache" ]]; then
            local before=$(dir_size_bytes "$brew_cache")
            if [[ "$DRY_RUN" != "true" ]]; then brew cleanup --prune=all 2>/dev/null || true; else log "[DRY-RUN] Would run: brew cleanup --prune=all"; fi
            local after=$(dir_size_bytes "$brew_cache")
            if (( before - after > 0 )); then log "Freed $(human_readable $((before-after))) from Homebrew"; fi
        fi
    fi
    foreach_user_home clean_pip_per_user
    foreach_user_home clean_conda_per_user
    foreach_user_home clean_yarn_per_user
    foreach_user_home clean_cocoapods_per_user
    foreach_user_home clean_gradle_per_user
    foreach_user_home clean_nuget_per_user
}

clean_ai_editor_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/.cursor/extensions" ]]; then safe_delete "$homedir/.cursor/extensions" 0 "--recursive"; fi
    if [[ -d "$homedir/.gemini" ]]; then safe_delete "$homedir/.gemini" 0 "--recursive"; fi
    if [[ -d "$homedir/.trae" ]]; then safe_delete "$homedir/.trae" 0 "--recursive"; fi
}

clean_ai_editor_extensions() {
    section "7. AI & Editor Extensions"
    foreach_user_home clean_ai_editor_per_user
}

clean_docker() {
    section "8. Docker Cleanup"
    if ! command -v docker &>/dev/null || ! docker info &>/dev/null 2>&1; then return 0; fi
    if [[ "$DRY_RUN" != "true" ]]; then
        docker container prune -f 2>/dev/null || true
        docker image prune -a -f --filter "until=${DOCKER_PRUNE_AGE}" 2>/dev/null || true
        docker volume prune -f 2>/dev/null || true
        docker builder prune -f --keep-storage=2gb 2>/dev/null || true
    else
        log "[DRY-RUN] Would prune Docker"
    fi
}

clean_mail_per_user() {
    local username="$1"; local homedir="$2"
    if [[ -d "$homedir/Library/Containers/com.apple.mail/Data/Library/Caches" ]]; then safe_delete "$homedir/Library/Containers/com.apple.mail/Data/Library/Caches" "$CACHE_MAX_AGE" "--recursive"; fi
    if [[ -d "$homedir/Library/Containers/com.apple.mail/Data/Library/Logs" ]]; then safe_delete "$homedir/Library/Containers/com.apple.mail/Data/Library/Logs" "$LOG_MAX_AGE" "--recursive"; fi
}

clean_mail_downloads() {
    section "9. Mail Downloads & Attachments"
    foreach_user_home clean_mail_per_user
}

clean_font_caches() {
    section "10. Font & Icon Caches"
    if [[ "$DRY_RUN" != "true" ]]; then
        if atsutil &>/dev/null 2>&1; then safe_run "Font cache rebuild" atsutil databases -remove; fi
    else
        log "[DRY-RUN] Would rebuild font cache"
    fi
}

clean_software_updates() {
    section "11. Software Update Cache"
    if [[ "$IS_ROOT" == "true" ]]; then
        safe_delete "/Library/Updates" 7 "--recursive"
        if [[ "$DRY_RUN" != "true" ]]; then softwareupdate --clear-catalog 2>/dev/null || true; fi
    fi
}

clean_tm_snapshots() {
    section "12. Time Machine Snapshots"
    if [[ "$IS_ROOT" == "true" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then log "[DRY-RUN] Would prune snapshots"; else tmutil deletelocalsnapshots / 2>/dev/null || true; fi
    else
        warn "Snapshots require root"
    fi
}

rotate_cleanup_logs() {
    section "13. Rotating Cleanup Logs"
    local log_count=$(find "${LOG_DIR}" -name "cleanup_*.log" -type f | wc -l | tr -d ' ')
    if (( log_count > MAX_LOG_RETAIN )); then
        local to_delete=$(( log_count - MAX_LOG_RETAIN ))
        if [[ "$DRY_RUN" != "true" ]]; then find "${LOG_DIR}" -name "cleanup_*.log" -type f | sort | head -n "$to_delete" | xargs rm -f 2>/dev/null || true; fi
    fi
}

# ═════════════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═════════════════════════════════════════════════════════════════════════════

main() {
    section "Mac Cleanup Service v${SCRIPT_VERSION} — Starting"
    log "Mode: $( [[ "$DRY_RUN" == "true" ]] && echo "DRY RUN" || echo "LIVE" )"
    local disk_before=$(df -k / | awk 'NR==2 {print $4}')

    clean_user_caches
    if [[ "$IS_ROOT" == "true" ]]; then
        clean_system_logs
        clean_temp_files
        clean_software_updates
    fi
    clean_crash_reports
    clean_xcode
    clean_package_caches
    clean_ai_editor_extensions
    clean_docker
    clean_mail_downloads
    clean_font_caches
    clean_tm_snapshots
    rotate_cleanup_logs

    local disk_after=$(df -k / | awk 'NR==2 {print $4}')
    local actual_freed_kb=$(( disk_after - disk_before ))
    local elapsed=$(( $(date +%s) - START_TIME ))

    section "Cleanup Summary"
    log "Tracked space freed : $(human_readable $TOTAL_FREED_BYTES)"
    log "Actual disk freed   : $(human_readable $((actual_freed_kb * 1024)))"
    log "Elapsed time        : ${elapsed}s"
    log "Errors encountered  : ${#ERRORS[@]}"
}

main "$@"
