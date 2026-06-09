# TypeScript/Vue.js Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Vue 3 + Nuxt 3 specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

### Auto-Format (Prettier)

Auto-format JS/TS/Vue files after edit:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|js|vue)$",
        "command": "npx prettier --write {{filePath}}"
      }
    ]
  }
}
```

### TypeScript Type Check

Run `tsc` after editing `.ts` or `.vue` files to catch type errors immediately:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|vue)$",
        "command": "npx vue-tsc --noEmit --pretty"
      }
    ]
  }
}
```

### ESLint with Vue Plugin

Run ESLint with `eslint-plugin-vue` after editing Vue or TypeScript files:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|js|vue)$",
        "command": "npx eslint --fix {{filePath}}"
      }
    ]
  }
}
```

The ESLint 9 flat config (`eslint.config.js`) should include:

```javascript
// eslint.config.js (flat config format)
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

export default [
  ...pluginVue.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',  // Nuxt pages are single-word
      'vue/no-v-html': 'error',                 // XSS prevention
      'vue/require-default-prop': 'error',
      'vue/component-api-style': ['error', ['script-setup']],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
    },
  },
]
```

### Nuxt Type Checking

For Nuxt-specific type checking, use `nuxi typecheck`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "(nuxt\\.config|app\\.config|pages/|middleware/|composables/|server/).*\\.(ts|vue)$",
        "command": "npx nuxi typecheck"
      }
    ]
  }
}
```

### console.log Warning

Warn about `console.log` usage in edited files:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|js|vue)$",
        "command": "grep -n 'console\\.log' {{filePath}} && echo 'WARNING: console.log found in {{filePath}}' || true"
      }
    ]
  }
}
```

## Stop Hooks

### Pre-Commit Quality Gate

Before the session ends, check all modified files:

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "git diff --name-only --cached | grep -E '\\.(ts|js|vue)$' | xargs -I {} sh -c 'grep -l console.log {} && echo \"WARNING: console.log in {}\"' || true"
      }
    ]
  }
}
```

### Full Lint Check

Run a full lint check on all staged TypeScript/Vue files before session ends:

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "git diff --name-only --cached | grep -E '\\.(ts|js|vue)$' | xargs npx eslint --max-warnings 0"
      }
    ]
  }
}
```

## Complete Hook Configuration Example

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|js|vue)$",
        "command": "npx prettier --write {{filePath}}"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|vue)$",
        "command": "npx eslint --fix {{filePath}}"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|vue)$",
        "command": "npx vue-tsc --noEmit --pretty 2>&1 | head -20"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(ts|js|vue)$",
        "command": "grep -n 'console\\.log' {{filePath}} && echo 'WARNING: Remove console.log before commit' || true"
      }
    ],
    "Stop": [
      {
        "command": "git diff --name-only --cached | grep -E '\\.(ts|js|vue)$' | xargs -I {} grep -l 'console\\.log' {} 2>/dev/null && echo 'BLOCKED: Remove console.log statements before committing' || echo 'Clean: no console.log in staged files'"
      }
    ]
  }
}
```
