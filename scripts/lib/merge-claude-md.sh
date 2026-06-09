#!/usr/bin/env bash
#
# merge-claude-md.sh - Idempotent CLAUDE.md framework section merger
#
# Provides merge_framework_section() which injects a marker-delimited block
# into an existing CLAUDE.md without disturbing surrounding content.
#
# Markers:
#   <!-- omnissiah:start -->
#   <!-- omnissiah:end -->
#
# Usage:
#   source scripts/lib/merge-claude-md.sh
#   merge_framework_section /path/to/CLAUDE.md /path/to/framework-section.md
#

# Marker strings
_MARKER_START="<!-- omnissiah:start -->"
_MARKER_END="<!-- omnissiah:end -->"

# merge_framework_section TARGET_FILE SECTION_FILE
#
# - If TARGET_FILE doesn't exist → copy SECTION_FILE as the entire file
# - If TARGET_FILE exists with markers → replace content between markers
# - If TARGET_FILE exists without markers → append section at the end
#
# Returns 0 on success, 1 on failure.
merge_framework_section() {
    local target_file="$1"
    local section_file="$2"

    if [ -z "${target_file}" ] || [ -z "${section_file}" ]; then
        echo "[ERROR] Usage: merge_framework_section TARGET_FILE SECTION_FILE" >&2
        return 1
    fi

    if [ ! -f "${section_file}" ]; then
        echo "[ERROR] Section file not found: ${section_file}" >&2
        return 1
    fi

    # Case 1: Target doesn't exist — copy section file directly
    if [ ! -f "${target_file}" ]; then
        cp "${section_file}" "${target_file}"
        return 0
    fi

    # Case 2: Target exists and already has markers — replace in place
    if grep -qF "${_MARKER_START}" "${target_file}" && grep -qF "${_MARKER_END}" "${target_file}"; then
        _replace_between_markers "${target_file}" "${section_file}"
        return $?
    fi

    # Case 3: Target exists without markers — append
    printf '\n' >> "${target_file}"
    cat "${section_file}" >> "${target_file}"
    printf '\n' >> "${target_file}"
    return 0
}

# has_framework_section FILE
# Returns 0 if the file contains the framework markers, 1 otherwise.
has_framework_section() {
    local file="$1"
    [ -f "${file}" ] && grep -qF "${_MARKER_START}" "${file}" && grep -qF "${_MARKER_END}" "${file}"
}

# --- internal helpers ---

# Replace everything between (and including) the start/end markers with new content.
# Args: FILE SECTION_FILE
_replace_between_markers() {
    local file="$1"
    local section_file="$2"
    local tmpfile="${file}.merge-tmp"

    # Build the output: lines before start marker, then section file, then lines after end marker
    {
        # Print lines before the start marker
        awk -v marker="${_MARKER_START}" 'index($0, marker) { exit } { print }' "${file}"
        # Print the new section content
        cat "${section_file}"
        # Print lines after the end marker
        awk -v marker="${_MARKER_END}" 'found { print } index($0, marker) { found = 1 }' "${file}"
    } > "${tmpfile}"

    if [ $? -ne 0 ]; then
        rm -f "${tmpfile}"
        echo "[ERROR] Failed to replace framework section in ${file}" >&2
        return 1
    fi

    mv "${tmpfile}" "${file}"
    return 0
}
