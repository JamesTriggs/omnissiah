# TypeScript/Vue.js Security

> This file extends [common/security.md](../common/security.md) with Vue 3 + Nuxt 3 specific content.

## Secret Management

```typescript
// NEVER: Hardcoded secrets (even in Nuxt runtime config)
const apiKey = "sk-proj-xxxxx"

// NEVER: Secrets in client-side code
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Private keys (server-only) -- sourced from environment variables
    apiSecret: '',           // Set via NUXT_API_SECRET env var
    dbPassword: '',  // Set via NUXT_DB_PASSWORD env var

    // Public keys (exposed to client) -- safe values only
    public: {
      apiBase: '/api/v1',    // No secrets in public config
      appVersion: '1.0.0',
    },
  },
})
```

```typescript
// ALWAYS: Access private config only in server routes
// server/api/events.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  // config.apiSecret is available here (server-side only)
  // config.public.apiBase is available everywhere
})
```

```typescript
// ALWAYS: Validate environment variables at build time
// nuxt.config.ts
if (process.env.NODE_ENV === 'production') {
  const required = ['NUXT_API_SECRET', 'NUXT_DB_PASSWORD']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}
```

## Content Security Policy (CSP) Headers

Configure CSP headers to prevent XSS and data exfiltration:

```typescript
// server/middleware/security-headers.ts
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    // Strict CSP -- adjust based on requirements
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'nonce-{{nonce}}'",  // Use nonces for inline scripts
      "style-src 'self' 'unsafe-inline'",      // Needed for Vue scoped styles
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' wss://",             // WebSocket for real-time updates
      "frame-ancestors 'none'",                 // Prevent clickjacking
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),

    // Additional security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',  // Rely on CSP instead (XSS-Protection can introduce issues)
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  })
})
```

For Nuxt configuration:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  },
})
```

## XSS Prevention for Vue Templates

### v-html Prohibition

NEVER use `v-html` with user-supplied data. ESLint rule `vue/no-v-html` should be set to `error`.

```vue
<!-- BAD: XSS vulnerability via v-html -->
<div v-html="userProvidedContent"></div>

<!-- BAD: Even "sanitized" HTML is risky -->
<div v-html="sanitize(userInput)"></div>

<!-- GOOD: Vue template interpolation auto-escapes -->
<div>{{ userProvidedContent }}</div>

<!-- GOOD: Use a safe rendering component for rich text -->
<RichTextRenderer :content="userProvidedContent" />
```

If `v-html` is absolutely required (e.g., rendering markdown documentation), sanitize with DOMPurify:

```typescript
import DOMPurify from 'dompurify'

const sanitizedHtml = computed(() =>
  DOMPurify.sanitize(rawHtml.value, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
)
```

```vue
<!-- Only after DOMPurify sanitization with strict allowlist -->
<!-- eslint-disable-next-line vue/no-v-html -->
<div v-html="sanitizedHtml"></div>
```

### Dynamic Attribute Binding

```vue
<!-- BAD: User-controlled href can execute JavaScript -->
<a :href="userProvidedUrl">Link</a>

<!-- GOOD: Validate URL protocol -->
<a :href="safeUrl">Link</a>
```

```typescript
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#'  // Block javascript:, data:, vbscript: protocols
    }
    return parsed.toString()
  } catch {
    return '#'
  }
}

const safeUrl = computed(() => sanitizeUrl(userProvidedUrl.value))
```

### Event Handler Injection

```typescript
// BAD: Dynamic event handler from user input
const handler = new Function(userInput)  // Code injection

// GOOD: Map user choices to predefined handlers
const handlers: Record<string, () => void> = {
  'sort-asc': () => sortEvents('asc'),
  'sort-desc': () => sortEvents('desc'),
  'filter-critical': () => filterBySeverity(8),
}

function handleAction(action: string): void {
  const handler = handlers[action]
  if (handler) handler()
}
```

## the query dialect Injection Prevention in Explorer

The Explorer allows users to write custom queries using the the query dialect dialect. This is a high-risk feature.

### Client-Side Guardrails

```typescript
// composables/useQueryValidator.ts

const DANGEROUS_PATTERNS = [
  /\bsystem\b/i,           // system database access
  /\burl\s*\(/i,           // url() table function
  /\bfile\s*\(/i,          // file() table function
  /\bremote\s*\(/i,        // remote() table function
  /\bINTO\s+OUTFILE\b/i,   // File writes
  /\bATTACH\b/i,           // Attach database
  /\bDETACH\b/i,           // Detach database
  /\bDROP\b/i,             // Drop operations
  /\bTRUNCATE\b/i,         // Truncate operations
  /\bALTER\b/i,            // Alter operations
  /\bCREATE\b/i,           // Create operations
  /\bINSERT\b/i,           // Insert operations
  /\bDELETE\b/i,           // Delete operations
  /\bGRANT\b/i,            // Permission changes
  /\bREVOKE\b/i,           // Permission changes
]

export function useQueryValidator() {
  function validateQuery(query: string): { valid: boolean; error?: string } {
    // Check for dangerous patterns (client-side pre-filter)
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(query)) {
        return {
          valid: false,
          error: `Query contains disallowed operation: ${pattern.source}`,
        }
      }
    }

    // Check query length
    if (query.length > 10_000) {
      return { valid: false, error: 'Query exceeds maximum length' }
    }

    // Check for excessive subquery depth (basic heuristic)
    const openParens = (query.match(/\(/g) ?? []).length
    if (openParens > 20) {
      return { valid: false, error: 'Query too complex (excessive nesting)' }
    }

    return { valid: true }
  }

  return { validateQuery }
}
```

```vue
<!-- Explorer query input with validation -->
<script setup lang="ts">
const { validateQuery } = useQueryValidator()
const { executeQuery, error: queryError } = useAnalyticsQuery()

const queryText = ref('')
const validationError = ref<string | null>(null)

async function submitQuery(): Promise<void> {
  const validation = validateQuery(queryText.value)
  if (!validation.valid) {
    validationError.value = validation.error ?? 'Invalid query'
    return
  }
  validationError.value = null

  // Server-side the query parser handles full validation and access scoping
  await executeQuery(queryText.value)
}
</script>

<template>
  <div class="explorer">
    <textarea v-model="queryText" class="query-editor" />
    <div v-if="validationError" class="error">{{ validationError }}</div>
    <div v-if="queryError" class="error">{{ queryError }}</div>
    <button @click="submitQuery" :disabled="!queryText.trim()">
      Execute Query
    </button>
  </div>
</template>
```

**Critical**: Client-side validation is a convenience for the user. The **real** security enforcement happens server-side in the the query dialect parser and the analytics database user permissions. Never rely solely on client-side checks.

## Authentication Security

### Token Storage

```typescript
// GOOD: Store JWT in httpOnly cookie (set by server)
// The server sets: Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// BAD: Storing tokens in localStorage (XSS-accessible)
localStorage.setItem('token', jwt)

// BAD: Storing tokens in sessionStorage (XSS-accessible)
sessionStorage.setItem('token', jwt)

// ACCEPTABLE: Nuxt useCookie for non-sensitive session state
const sessionPrefs = useCookie('app_prefs', {
  httpOnly: false,  // Client needs to read this
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24,  // 1 day
})
```

### Route Guards

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated.value && to.path !== '/login') {
    return navigateTo('/login')
  }
})

// middleware/tenant.ts
export default defineNuxtRouteMiddleware(() => {
  const { organisationId } = useAuth()

  if (!organisationId.value) {
    return navigateTo('/select-organisation')
  }
})
```

## Dependency Security

### Safe Package Management

```json
// package.json
{
  "overrides": {
    // Pin transitive dependencies with known CVEs
  },
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "audit:fix": "npm audit fix"
  }
}
```

Run `npm audit` in CI and fail the build on high/critical vulnerabilities.

### Subresource Integrity (SRI)

For any externally loaded scripts (if CSP allows), use SRI:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-xxxxx"
  crossorigin="anonymous"
></script>
```

## Agent Support

- Use **security-reviewer** agent for comprehensive security audits of Vue components
- Use **e2e-runner** agent for testing authentication flows and access control
