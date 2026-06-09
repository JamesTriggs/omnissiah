#!/usr/bin/env bash
#
# install.sh - omnissiah Installer
#
# Installs omnissiah into the user's Claude Code configuration.
# Supports Python, TypeScript, and C++ project types.
#
# Usage:
#   ./install.sh                    # Interactive installation
#   ./install.sh --language python  # Install Python-specific rules
#   ./install.sh --language typescript
#   ./install.sh --language cpp
#   ./install.sh --all              # Install all language rules
#   ./install.sh --force            # Force reinstall (overwrite existing hooks/MCP)
#   ./install.sh --non-interactive  # Skip interactive prompts, install all languages
#   ./install.sh --uninstall        # Remove framework configuration
#   ./install.sh --update-claude-md [DIR]  # Merge framework section into CLAUDE.md
#
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Framework paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${HOME}/.claude"
CLAUDE_SETTINGS="${CLAUDE_DIR}/settings.json"
CLAUDE_SKILLS_DIR="${CLAUDE_DIR}/skills"
SESSIONS_DIR="${CLAUDE_DIR}/sessions"
HOMUNCULUS_DIR="${CLAUDE_DIR}/homunculus"

# Framework metadata
FRAMEWORK_NAME="omnissiah"
FRAMEWORK_VERSION="0.1.0"
FRAMEWORK_SECTION="${SCRIPT_DIR}/examples/framework-section.md"

# Source the merge helper
source "${SCRIPT_DIR}/scripts/lib/merge-claude-md.sh"

print_banner() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  omnissiah v${FRAMEWORK_VERSION}${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for Node.js (required for hooks)
    if ! command -v node &>/dev/null; then
        log_error "Node.js is required but not installed."
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
            log_info "Install with: winget install OpenJS.NodeJS  (or: choco install nodejs)"
        elif [[ "$OSTYPE" == "linux"* ]]; then
            log_info "Install with: sudo apt-get install nodejs  (or use nvm: https://github.com/nvm-sh/nvm)"
        else
            log_info "Install with: brew install node"
        fi
        exit 1
    fi
    log_success "Node.js $(node --version)"

    # Check Node.js version >= 18
    node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt 18 ] 2>/dev/null; then
        log_error "Node.js >= 18 required (found v${node_version})"
        exit 1
    fi

    # Check for Python 3 (required for instinct CLI)
    if ! command -v python3 &>/dev/null; then
        log_error "Python 3 is required but not installed."
        exit 1
    fi
    log_success "Python $(python3 --version 2>&1 | cut -d' ' -f2)"

    # Check Python >= 3.10
    python_version=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    python_major=$(echo "$python_version" | cut -d. -f1)
    python_minor=$(echo "$python_version" | cut -d. -f2)
    if [ "$python_major" -lt 3 ] || ([ "$python_major" -eq 3 ] && [ "$python_minor" -lt 10 ]); then
        log_error "Python >= 3.10 required (found ${python_version})"
        exit 1
    fi

    # Check for jq (required for hooks and MCP configuration)
    if ! command -v jq &>/dev/null; then
        log_error "jq is required but not installed."
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
            log_info "Install with: winget install jqlang.jq  (or: choco install jq)"
        elif [[ "$OSTYPE" == "linux"* ]]; then
            log_info "Install with: sudo apt-get install jq"
        else
            log_info "Install with: brew install jq"
        fi
        exit 1
    fi
    log_success "jq $(jq --version 2>&1)"

    # Check jq version >= 1.6 (walk() builtin required by install_mcp)
    jq_version=$(jq --version 2>&1 | sed 's/jq-//')
    jq_major=$(echo "$jq_version" | cut -d. -f1)
    jq_minor=$(echo "$jq_version" | cut -d. -f2)
    if [ "${jq_major:-0}" -lt 1 ] || ([ "${jq_major:-0}" -eq 1 ] && [ "${jq_minor:-0}" -lt 6 ]); then
        log_error "jq >= 1.6 required (found ${jq_version}). The walk() builtin is not available in jq 1.5."
        log_info "Upgrade jq: https://stedolan.github.io/jq/download/"
        exit 1
    fi

    # Check for git
    if ! command -v git &>/dev/null; then
        log_error "git is required but not installed."
        exit 1
    fi
    log_success "git $(git --version | cut -d' ' -f3)"

    echo ""
}

# Merge framework section into an existing project CLAUDE.md
check_existing_claude_md() {
    local target_dir="${1:-.}"
    local target_file="${target_dir}/CLAUDE.md"

    if [ ! -f "${target_file}" ]; then
        return 0
    fi

    if has_framework_section "${target_file}"; then
        log_info "Updating framework section in ${target_file}..."
        merge_framework_section "${target_file}" "${FRAMEWORK_SECTION}"
        log_success "Framework section updated in ${target_file}"
    else
        log_info "Appending framework section to ${target_file}..."
        merge_framework_section "${target_file}" "${FRAMEWORK_SECTION}"
        log_success "Framework section added to ${target_file}"
    fi
    return 0
}

# Create directory structure
create_directories() {
    log_info "Creating directory structure..."

    mkdir -p "${CLAUDE_DIR}"
    mkdir -p "${SESSIONS_DIR}"
    mkdir -p "${CLAUDE_SKILLS_DIR}"
    mkdir -p "${HOMUNCULUS_DIR}/instincts/personal"
    mkdir -p "${HOMUNCULUS_DIR}/instincts/inherited"
    mkdir -p "${HOMUNCULUS_DIR}/evolved/agents"
    mkdir -p "${HOMUNCULUS_DIR}/evolved/skills"
    mkdir -p "${HOMUNCULUS_DIR}/evolved/commands"

    log_success "Directory structure created"
}

# Install hooks into settings.json
#
# Uses scripts/lib/hooks-merge.js for an idempotent MERGE: every framework hook
# declared in hooks/hooks.json is ensured present, user hooks are preserved,
# running twice is a no-op. This is how the memory observation hook and every
# other base hook (secret check, git checkpoint, safety guards, lint, etc.)
# reliably land on consumer machines — even when they already have hooks
# configured from a previous install or custom setup.
#
# --force semantics: wipe .hooks first, then merge — useful for migrating
# legacy inline-bash hooks to their newer node-script equivalents.
install_hooks() {
    log_info "Installing hooks (idempotent merge)..."

    if [ ! -f "${CLAUDE_SETTINGS}" ]; then
        log_info "Creating ${CLAUDE_SETTINGS}"
        echo '{}' > "${CLAUDE_SETTINGS}"
    fi

    if [ "$force_reinstall" = true ] && [ -f "${CLAUDE_SETTINGS}" ]; then
        log_info "Force mode: removing existing hooks before re-merging"
        cp "${CLAUDE_SETTINGS}" "${CLAUDE_SETTINGS}.backup.$(date +%s)"
        log_info "Backed up settings to ${CLAUDE_SETTINGS}.backup.*"
        # Normalise the file so the subsequent merger always sees valid JSON.
        # If the file parses, strip .hooks; if it doesn't (corrupt), replace
        # with {} — --force semantics justify the rewrite and matches the
        # behaviour of install.js readSettings(true).
        if jq 'del(.hooks)' "${CLAUDE_SETTINGS}" > "${CLAUDE_SETTINGS}.tmp" 2>/dev/null; then
            mv "${CLAUDE_SETTINGS}.tmp" "${CLAUDE_SETTINGS}"
        else
            log_warn "${CLAUDE_SETTINGS} contains invalid JSON — overwriting due to --force"
            rm -f "${CLAUDE_SETTINGS}.tmp"
            echo '{}' > "${CLAUDE_SETTINGS}"
        fi
    fi

    if ! node "${SCRIPT_DIR}/scripts/lib/hooks-merge.js" \
             "${CLAUDE_SETTINGS}" \
             "${SCRIPT_DIR}" \
             "${SCRIPT_DIR}/hooks/hooks.json"; then
        log_error "Failed to merge hooks into ${CLAUDE_SETTINGS}"
        return 1
    fi

    log_success "Hooks merged into ${CLAUDE_SETTINGS}"
}

# Install MCP server configuration
install_mcp() {
    log_info "Installing MCP server configuration..."

    if [ ! -f "${CLAUDE_SETTINGS}" ]; then
        echo '{}' > "${CLAUDE_SETTINGS}"
    fi

    if jq -e '.mcpServers' "${CLAUDE_SETTINGS}" &>/dev/null 2>&1; then
        if [ "$force_reinstall" = true ]; then
            log_info "Force reinstalling MCP servers..."
            # Backup first, then delete existing mcpServers before re-adding
            cp "${CLAUDE_SETTINGS}" "${CLAUDE_SETTINGS}.backup.$(date +%s)"
            log_info "Backed up settings to ${CLAUDE_SETTINGS}.backup.*"
            jq 'del(.mcpServers)' "${CLAUDE_SETTINGS}" > "${CLAUDE_SETTINGS}.tmp"
            mv "${CLAUDE_SETTINGS}.tmp" "${CLAUDE_SETTINGS}"
        else
            log_warn "MCP servers already configured in ${CLAUDE_SETTINGS}"
            log_info "Use --force to reinstall"
            return 0
        fi
    fi

    # Backup settings.json before modification
    cp "${CLAUDE_SETTINGS}" "${CLAUDE_SETTINGS}.backup.$(date +%s)"
    log_info "Backed up settings to ${CLAUDE_SETTINGS}.backup.*"

    # Merge MCP server configuration from framework
    # Resolve ${HOME}/.claude using jq --arg to safely handle special characters in HOME path
    local mcp_content
    mcp_content=$(jq --arg claudedir "${HOME}/.claude" \
      'walk(if type == "string" and startswith("${HOME}/.claude")
            then ($claudedir + ltrimstr("${HOME}/.claude")) else . end) | .mcpServers' \
      "${SCRIPT_DIR}/mcp-configs/mcp-servers.json") \
        || { log_error "Failed to parse mcp-configs/mcp-servers.json with jq"; return 1; }
    jq --argjson mcp "${mcp_content}" '. + {mcpServers: $mcp}' "${CLAUDE_SETTINGS}" > "${CLAUDE_SETTINGS}.tmp"
    mv "${CLAUDE_SETTINGS}.tmp" "${CLAUDE_SETTINGS}"
    log_success "MCP servers configured in ${CLAUDE_SETTINGS}"
}

# Install language-specific rules
install_language_rules() {
    local language="$1"
    log_info "Installing ${language} rules..."

    case "${language}" in
        python)
            # Check for Python-specific tools
            if command -v ruff &>/dev/null; then
                log_success "Ruff found: $(ruff --version)"
            else
                log_warn "Ruff not found. Install with: pip install ruff"
            fi
            if command -v mypy &>/dev/null; then
                log_success "mypy found: $(mypy --version 2>&1 | head -1)"
            else
                log_warn "mypy not found. Install with: pip install mypy"
            fi
            if command -v uv &>/dev/null; then
                log_success "uv found: $(uv --version 2>&1)"
            else
                log_warn "uv not found. Install with: pip install uv"
            fi
            log_success "Python rules installed (rules/python/)"
            ;;
        typescript)
            if command -v npx &>/dev/null; then
                log_success "npx found"
            else
                log_warn "npx not found. Install Node.js."
            fi
            log_success "TypeScript/Vue rules available via ESLint hooks"
            ;;
        cpp)
            if command -v cppcheck &>/dev/null; then
                log_success "cppcheck found: $(cppcheck --version)"
            else
                if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
                    log_warn "cppcheck not found. Install with: winget install Cppcheck.Cppcheck  (or: choco install cppcheck)"
                elif [[ "$OSTYPE" == "linux"* ]]; then
                    log_warn "cppcheck not found. Install with: sudo apt-get install cppcheck"
                else
                    log_warn "cppcheck not found. Install with: brew install cppcheck"
                fi
            fi
            if command -v cmake &>/dev/null; then
                log_success "cmake found: $(cmake --version | head -1)"
            else
                if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
                    log_warn "cmake not found. Install with: winget install Kitware.CMake  (or: choco install cmake)"
                elif [[ "$OSTYPE" == "linux"* ]]; then
                    log_warn "cmake not found. Install with: sudo apt-get install cmake"
                else
                    log_warn "cmake not found. Install with: brew install cmake"
                fi
            fi
            log_success "C++ rules available via cppcheck hooks"
            ;;
        *)
            log_error "Unknown language: ${language}. Supported: python, typescript, cpp"
            return 1
            ;;
    esac
}

# Install skills (symlink to framework)
#
# The skill list is derived from the repo's skills/ tree: any subdirectory that
# contains a SKILL.md is a skill. This keeps the installer in step with whatever
# skills the framework actually provides.
install_skills() {
    log_info "Installing skills..."

    for src in "${SCRIPT_DIR}"/skills/*/; do
        [ -f "${src}SKILL.md" ] || continue
        local skill
        skill="$(basename "${src}")"
        local dst="${CLAUDE_SKILLS_DIR}/${skill}"

        if [ -L "${dst}" ] || [ -d "${dst}" ]; then
            log_info "Skill already installed: ${skill}"
        else
            ln -s "${src%/}" "${dst}"
            log_success "Linked skill: ${skill}"
        fi
    done

    log_success "Skills installed"
}

# Install plugin to Claude Code plugin locations so slash commands are available.
# Claude Code loads /commands from plugins, not from settings.json.
install_plugin() {
    log_info "Installing plugin (commands, agents, skills)..."

    local content_dirs=(".claude-plugin" "commands" "agents" "skills" "contexts")

    # Helper: sync a directory to a destination
    sync_dir() {
        local src="$1" dst="$2"
        [ -d "${src}" ] || return 0
        mkdir -p "${dst}"
        cp -r "${src}/." "${dst}/"
    }

    # Location 1: flat ~/.claude/commands/ (some Claude Code versions)
    mkdir -p "${CLAUDE_DIR}/commands"
    if [ -d "${SCRIPT_DIR}/commands" ]; then
        cp "${SCRIPT_DIR}/commands/"*.md "${CLAUDE_DIR}/commands/" 2>/dev/null || true
    fi

    # Location 2: direct plugin dir ~/.claude/plugins/omnissiah/
    local direct_plugin="${CLAUDE_DIR}/plugins/omnissiah"
    mkdir -p "${direct_plugin}"
    for d in "${content_dirs[@]}"; do
        sync_dir "${SCRIPT_DIR}/${d}" "${direct_plugin}/${d}"
    done

    # Location 3: marketplace plugin dir
    local marketplace_plugin="${CLAUDE_DIR}/plugins/marketplaces/claude-plugins-official/plugins/omnissiah"
    mkdir -p "${marketplace_plugin}"
    for d in "${content_dirs[@]}"; do
        sync_dir "${SCRIPT_DIR}/${d}" "${marketplace_plugin}/${d}"
    done

    log_success "Plugin installed (commands: /project, /tldr, /health, /orchestrate, etc.)"
}

# Add the claude() shell wrapper to the user's shell profile.
# This shows the omnissiah banner + health check before every Claude session
# (workaround for SessionStart hooks not firing in some Claude Code versions).
install_shell_wrapper() {
    log_info "Installing shell wrapper..."

    local wrapper_block
    wrapper_block=$(cat <<'WRAPPER'

# omnissiah — show banner before every Claude session
claude() {
    node "SCRIPT_DIR_PLACEHOLDER/scripts/hooks/session-start.js"
    command claude "$@"
}
WRAPPER
)
    wrapper_block="${wrapper_block//SCRIPT_DIR_PLACEHOLDER/${SCRIPT_DIR}}"

    local marker="omnissiah"

    # Detect shell and choose profile file
    local profile_file=""
    if [ -n "${ZSH_VERSION:-}" ] || echo "${SHELL}" | grep -q "zsh"; then
        profile_file="${HOME}/.zshrc"
    elif [ -n "${BASH_VERSION:-}" ] || echo "${SHELL}" | grep -q "bash"; then
        profile_file="${HOME}/.bashrc"
        # On macOS, .bash_profile is the login shell config
        [ "$(uname)" = "Darwin" ] && profile_file="${HOME}/.bash_profile"
    else
        profile_file="${HOME}/.profile"
    fi

    if grep -q "${marker}" "${profile_file}" 2>/dev/null; then
        log_info "Shell wrapper already in ${profile_file}"
    else
        echo "${wrapper_block}" >> "${profile_file}"
        log_success "Shell wrapper added to ${profile_file}"
        log_info "Run: source ${profile_file}  (or open a new terminal)"
    fi
}

# Install user-level CLAUDE.md template (or merge framework section into existing)
install_user_config() {
    local user_claude="${CLAUDE_DIR}/CLAUDE.md"

    if [ ! -f "${user_claude}" ]; then
        log_info "Installing user-level CLAUDE.md template..."
        cp "${SCRIPT_DIR}/examples/user-CLAUDE.md" "${user_claude}"
        log_success "User CLAUDE.md installed at ${user_claude}"
        log_info "Customize your preferences in ${user_claude}"
    elif has_framework_section "${user_claude}"; then
        log_info "Updating framework section in ${user_claude}..."
        merge_framework_section "${user_claude}" "${FRAMEWORK_SECTION}"
        log_success "Framework section updated in ${user_claude}"
    else
        log_info "Merging framework section into ${user_claude}..."
        merge_framework_section "${user_claude}" "${FRAMEWORK_SECTION}"
        log_success "Framework section added to ${user_claude}"
    fi
}

# Verify installation
verify_installation() {
    echo ""
    log_info "Verifying installation..."

    local checks_passed=0
    local checks_total=0

    # Check settings.json
    checks_total=$((checks_total + 1))
    if [ -f "${CLAUDE_SETTINGS}" ]; then
        log_success "Settings file exists"
        checks_passed=$((checks_passed + 1))
    else
        log_error "Settings file missing"
    fi

    # Check hooks
    checks_total=$((checks_total + 1))
    if jq -e '.hooks' "${CLAUDE_SETTINGS}" &>/dev/null 2>&1; then
        log_success "Hooks configured"
        checks_passed=$((checks_passed + 1))
    else
        log_warn "Hooks not configured"
    fi

    # Check sessions directory
    checks_total=$((checks_total + 1))
    if [ -d "${SESSIONS_DIR}" ]; then
        log_success "Sessions directory exists"
        checks_passed=$((checks_passed + 1))
    else
        log_error "Sessions directory missing"
    fi

    # Check homunculus directory
    checks_total=$((checks_total + 1))
    if [ -d "${HOMUNCULUS_DIR}" ]; then
        log_success "Learning system directory exists"
        checks_passed=$((checks_passed + 1))
    else
        log_warn "Learning system directory missing"
    fi

    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  Installation Summary: ${checks_passed}/${checks_total} checks passed${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
}

# Uninstall
uninstall() {
    log_info "Uninstalling omnissiah..."

    # Remove hooks from settings
    if [ -f "${CLAUDE_SETTINGS}" ] && command -v jq &>/dev/null; then
        jq 'del(.hooks)' "${CLAUDE_SETTINGS}" > "${CLAUDE_SETTINGS}.tmp"
        mv "${CLAUDE_SETTINGS}.tmp" "${CLAUDE_SETTINGS}"
        log_success "Hooks removed from settings"
    fi

    # Remove skill symlinks (but not the skills themselves), derived from the
    # repo's skills/ tree so this stays in step with what was installed.
    for src in "${SCRIPT_DIR}"/skills/*/; do
        [ -f "${src}SKILL.md" ] || continue
        local skill
        skill="$(basename "${src}")"
        local dst="${CLAUDE_SKILLS_DIR}/${skill}"
        if [ -L "${dst}" ]; then
            rm "${dst}"
            log_success "Removed skill link: ${skill}"
        fi
    done

    log_success "Framework uninstalled. User data (sessions, instincts) preserved."
}

# Print post-install instructions
print_next_steps() {
    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "  1. Configure any MCP servers you need:"
    echo "     Edit ${SCRIPT_DIR}/mcp-configs/mcp-servers.json, then re-run with --force."
    echo "     Reference secrets via environment variables, never hardcode them."
    echo ""
    echo "  2. Customise your user config:"
    echo "     ${CLAUDE_DIR}/CLAUDE.md"
    echo ""
    echo "  3. Copy the project CLAUDE.md template to your repos:"
    echo "     cp ${SCRIPT_DIR}/examples/CLAUDE.md /path/to/your-repo/CLAUDE.md"
    echo ""
    echo "  4. Start a Claude Code session and try:"
    echo "     /code-review"
    echo "     /sessions list"
    echo "     /instinct-status"
    echo ""
    echo "  5. Read the guide:"
    echo "     ${SCRIPT_DIR}/the-omnissiah-guide.md"
    echo ""
}

# Main
main() {
    print_banner

    local language=""
    local install_all=false
    local do_uninstall=false
    local update_claude_md=""
    local force_reinstall=false
    local non_interactive=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --language)
                language="$2"
                shift 2
                ;;
            --all)
                install_all=true
                shift
                ;;
            --uninstall)
                do_uninstall=true
                shift
                ;;
            --update-claude-md)
                # Peek at next arg: if it exists and is not a flag, use it as the dir
                if [[ $# -gt 1 && "${2}" != --* ]]; then
                    update_claude_md="${2}"
                    shift 2
                else
                    update_claude_md="."
                    shift 1
                fi
                ;;
            --force)
                force_reinstall=true
                shift
                ;;
            --non-interactive)
                non_interactive=true
                shift
                ;;
            --help|-h)
                echo "Usage: ./install.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --language <lang>       Install language-specific rules (python, typescript, cpp)"
                echo "  --all                   Install all language rules"
                echo "  --force                 Force reinstall (overwrite existing hooks/MCP config)"
                echo "  --non-interactive       Skip interactive prompts, install all languages"
                echo "  --uninstall             Remove framework configuration"
                echo "  --update-claude-md DIR  Merge framework section into DIR/CLAUDE.md"
                echo "  --help, -h              Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    if [ "$do_uninstall" = true ]; then
        uninstall
        exit 0
    fi

    # Standalone CLAUDE.md merge (no full install required)
    if [ -n "${update_claude_md}" ]; then
        local target="${update_claude_md}/CLAUDE.md"
        log_info "Merging framework section into ${target}..."
        merge_framework_section "${target}" "${FRAMEWORK_SECTION}"
        if [ $? -eq 0 ]; then
            if [ -f "${target}" ]; then
                log_success "Framework section merged into ${target}"
            else
                log_success "Created ${target} with framework section"
            fi
        else
            log_error "Failed to merge framework section into ${target}"
            exit 1
        fi
        exit 0
    fi

    check_prerequisites
    create_directories
    install_hooks
    install_mcp
    install_skills
    install_plugin
    install_shell_wrapper
    install_user_config

    # Install language-specific rules
    if [ "$install_all" = true ]; then
        install_language_rules "python"
        install_language_rules "typescript"
        install_language_rules "cpp"
    elif [ -n "${language}" ]; then
        install_language_rules "${language}"
    else
        # Non-interactive mode or non-terminal: install all languages
        if [ "$non_interactive" = true ] || ! [ -t 0 ]; then
            log_info "Non-interactive mode: installing all language rules"
            install_language_rules "python"
            install_language_rules "typescript"
            install_language_rules "cpp"
        else
            # Interactive: ask which languages
            echo ""
            echo "Which language rules would you like to install?"
            echo "  1) Python (Flask, FastAPI, Ruff, mypy)"
            echo "  2) TypeScript (Vue 3, Nuxt 3, ESLint)"
            echo "  3) C++ (CMake, cppcheck, Google Test)"
            echo "  4) All"
            echo "  5) Skip"
            echo ""
            read -rp "Enter choice [4]: " lang_choice
            lang_choice=${lang_choice:-4}

            case "${lang_choice}" in
                1) install_language_rules "python" ;;
                2) install_language_rules "typescript" ;;
                3) install_language_rules "cpp" ;;
                4)
                    install_language_rules "python"
                    install_language_rules "typescript"
                    install_language_rules "cpp"
                    ;;
                5) log_info "Skipping language rules" ;;
                *) log_warn "Invalid choice, skipping language rules" ;;
            esac
        fi
    fi

    verify_installation
    print_next_steps
}

main "$@"
