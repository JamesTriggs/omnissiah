/**
 * Session manager for Claude Code
 *
 * Provides functions to list, find, and inspect session files
 * stored in ~/.claude/sessions/
 *
 * Session filename patterns:
 *   YYYY-MM-DD-<shortid>-session.tmp   (standard format)
 *   YYYY-MM-DD-session.tmp             (old format, no ID)
 */

const fs = require('fs');
const path = require('path');
const { getSessionsDir, readFile, findFiles } = require('./utils');

/**
 * Parse a session filename into its component parts
 * @param {string} filename - Session filename (e.g., "2026-02-10-abc12345-session.tmp")
 * @returns {{ date: string, shortId: string } | null}
 */
function parseSessionFilename(filename) {
  // Standard format: YYYY-MM-DD-<shortid>-session.tmp
  const standardMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)-session\.tmp$/);
  if (standardMatch) {
    return {
      date: standardMatch[1],
      shortId: standardMatch[2]
    };
  }

  // Old format: YYYY-MM-DD-session.tmp
  const oldMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-session\.tmp$/);
  if (oldMatch) {
    return {
      date: oldMatch[1],
      shortId: 'no-id'
    };
  }

  return null;
}

/**
 * Extract metadata from session file content
 * Reads YAML-like frontmatter fields from the markdown session file
 * @param {string} content - Session file content
 * @returns {{ title: string|null, started: string|null, lastUpdated: string|null }}
 */
function extractMetadata(content) {
  const metadata = {
    title: null,
    started: null,
    lastUpdated: null
  };

  if (!content) {
    return metadata;
  }

  // Title from first heading: # Session: <title> or # <title>
  const titleMatch = content.match(/^#\s+(?:Session:\s*)?(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Started time from **Started:** <time>
  const startedMatch = content.match(/\*\*Started:\*\*\s*(.+)$/m);
  if (startedMatch) {
    metadata.started = startedMatch[1].trim();
  }

  // Last Updated from **Last Updated:** <time>
  const updatedMatch = content.match(/\*\*Last Updated:\*\*\s*(.+)$/m);
  if (updatedMatch) {
    metadata.lastUpdated = updatedMatch[1].trim();
  }

  return metadata;
}

/**
 * Build a session object from a file entry
 * @param {{ path: string, mtime: number }} fileEntry - File entry from findFiles
 * @returns {object|null} Session object or null if invalid
 */
function buildSessionObject(fileEntry, includeContent) {
  const filename = path.basename(fileEntry.path);
  const parsed = parseSessionFilename(filename);

  if (!parsed) {
    return null;
  }

  const session = {
    filename: filename,
    shortId: parsed.shortId,
    date: parsed.date,
    modifiedTime: new Date(fileEntry.mtime),
    sessionPath: fileEntry.path,
    metadata: {
      title: null,
      started: null,
      lastUpdated: null
    }
  };

  // Read content for metadata extraction (and optionally include it)
  try {
    const content = readFile(fileEntry.path);
    if (content) {
      session.metadata = extractMetadata(content);
      if (includeContent) {
        session.content = content;
      }
    }
  } catch {
    // File may have been deleted between listing and reading
  }

  return session;
}

/**
 * Get all sessions with optional filtering and pagination
 * @param {object} options - Options
 * @param {number} options.limit - Maximum number of sessions to return (default: 50)
 * @param {string} options.date - Filter by date (YYYY-MM-DD)
 * @param {string} options.search - Search pattern for session ID
 * @returns {{ sessions: Array, total: number }}
 */
function getAllSessions(options = {}) {
  const { limit = 50, date = null, search = null } = options;

  try {
    const sessionsDir = getSessionsDir();
    const files = findFiles(sessionsDir, '*-session.tmp');

    let sessions = [];

    for (const file of files) {
      const session = buildSessionObject(file, false);
      if (!session) {
        continue;
      }

      // Apply date filter
      if (date && session.date !== date) {
        continue;
      }

      // Apply search filter (matches against shortId)
      if (search && !session.shortId.includes(search) && !session.filename.includes(search)) {
        continue;
      }

      sessions.push(session);
    }

    const total = sessions.length;

    // Apply limit
    if (limit > 0) {
      sessions = sessions.slice(0, limit);
    }

    return { sessions, total };
  } catch {
    return { sessions: [], total: 0 };
  }
}

/**
 * Get a session by ID, date, or filename
 * Searches by shortId, date prefix, or full filename match
 * @param {string} sessionId - Session identifier (shortId, date, or filename)
 * @param {boolean} includeContent - Whether to include file content in the result
 * @returns {object|null} Session object or null if not found
 */
function getSessionById(sessionId, includeContent = false) {
  if (!sessionId) {
    return null;
  }

  try {
    const sessionsDir = getSessionsDir();
    const files = findFiles(sessionsDir, '*-session.tmp');

    for (const file of files) {
      const filename = path.basename(file.path);
      const parsed = parseSessionFilename(filename);

      if (!parsed) {
        continue;
      }

      // Match by exact filename
      if (filename === sessionId) {
        return buildSessionObject(file, includeContent);
      }

      // Match by shortId (exact or prefix)
      if (parsed.shortId !== 'no-id' && parsed.shortId === sessionId) {
        return buildSessionObject(file, includeContent);
      }

      // Match by shortId prefix (at least 4 characters)
      if (parsed.shortId !== 'no-id' && sessionId.length >= 4 && parsed.shortId.startsWith(sessionId)) {
        return buildSessionObject(file, includeContent);
      }

      // Match by date (for old-format sessions or when searching by date)
      if (parsed.date === sessionId) {
        return buildSessionObject(file, includeContent);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get human-readable file size for a session
 * @param {string} sessionPath - Absolute path to the session file
 * @returns {string} Human-readable size (e.g., "12.3 KB", "1.5 MB")
 */
function getSessionSize(sessionPath) {
  try {
    const stats = fs.statSync(sessionPath);
    const bytes = stats.size;

    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
  } catch {
    return '0 B';
  }
}

/**
 * Get statistics about a session's content
 * Counts lines, total checklist items, completed items, and in-progress items
 * @param {string} sessionPath - Absolute path to the session file
 * @returns {{ lineCount: number, totalItems: number, completedItems: number, inProgressItems: number }}
 */
function getSessionStats(sessionPath) {
  const stats = {
    lineCount: 0,
    totalItems: 0,
    completedItems: 0,
    inProgressItems: 0
  };

  try {
    const content = readFile(sessionPath);
    if (!content) {
      return stats;
    }

    const lines = content.split('\n');
    stats.lineCount = lines.length;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match completed items: - [x] or - [X]
      if (/^-\s+\[x\]/i.test(trimmed)) {
        stats.totalItems++;
        stats.completedItems++;
        continue;
      }

      // Match incomplete items: - [ ]
      if (/^-\s+\[\s\]/.test(trimmed)) {
        stats.totalItems++;
        stats.inProgressItems++;
        continue;
      }
    }

    return stats;
  } catch {
    return stats;
  }
}

module.exports = {
  parseSessionFilename,
  extractMetadata,
  getAllSessions,
  getSessionById,
  getSessionSize,
  getSessionStats
};
