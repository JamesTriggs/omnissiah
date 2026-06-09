/**
 * Session alias management for Claude Code
 *
 * Reads/writes session aliases from ~/.claude/session-aliases.json
 */

const fs = require('fs');
const { getAliasesPath } = require('./utils');

/**
 * Read and parse the aliases JSON file
 * @returns {object} Parsed aliases data, or empty object on error
 */
function _readAliases() {
  const aliasesPath = getAliasesPath();

  try {
    return JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Write aliases data to the JSON file
 * @param {object} data - Aliases object to write
 */
function _writeAliases(data) {
  const aliasesPath = getAliasesPath();
  fs.writeFileSync(aliasesPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * List session aliases
 * @param {object} options - Options
 * @param {number} options.limit - Maximum number of aliases to return
 * @returns {Array<{name: string, sessionPath: string}>}
 */
function listAliases(options = {}) {
  try {
    const data = _readAliases();
    let entries = Object.entries(data).map(([name, sessionPath]) => ({
      name,
      sessionPath
    }));

    if (options.limit && options.limit > 0) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Look up an alias by name
 * @param {string} name - Alias name to resolve
 * @returns {{name: string, sessionPath: string}|null} Resolved alias or null if not found
 */
function resolveAlias(name) {
  try {
    const data = _readAliases();

    if (data[name]) {
      return { name, sessionPath: data[name] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create or update an alias
 * @param {string} name - Alias name
 * @param {string} sessionFilename - Session filename to point to
 * @returns {{success: boolean, error?: string}}
 */
function setAlias(name, sessionFilename) {
  try {
    const data = _readAliases();
    data[name] = sessionFilename;
    _writeAliases(data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove an alias
 * @param {string} name - Alias name to delete
 * @returns {{success: boolean, error?: string}}
 */
function deleteAlias(name) {
  try {
    const data = _readAliases();

    if (!(name in data)) {
      return { success: false, error: 'Alias not found: ' + name };
    }

    delete data[name];
    _writeAliases(data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Find all aliases that point to a given session filename
 * @param {string} sessionFilename - Session filename to search for
 * @returns {Array<{name: string, sessionPath: string}>}
 */
function getAliasesForSession(sessionFilename) {
  try {
    const data = _readAliases();

    return Object.entries(data)
      .filter(([, value]) => value === sessionFilename)
      .map(([name, sessionPath]) => ({ name, sessionPath }));
  } catch {
    return [];
  }
}

module.exports = {
  listAliases,
  resolveAlias,
  setAlias,
  deleteAlias,
  getAliasesForSession
};
