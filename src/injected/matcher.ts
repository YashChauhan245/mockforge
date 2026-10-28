import { MockRule, HttpMethod } from '../types/rule';

/**
 * Converts a glob pattern (with * and ? wildcards) or regex string into a RegExp.
 * Examples:
 *   "*\/api/users/*" -> matches any URL containing /api/users/
 *   "https://api.example.com/v1/*" -> matches URLs starting with that prefix
 *   "/^\/api\/v[12]\//i" -> parses inline RegExp
 */
export function globToRegex(pattern: string): RegExp {
  const trimmed = pattern.trim();

  // 1. Check if user provided explicit regex notation: /regex/flags
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const lastSlashIndex = trimmed.lastIndexOf('/');
    const patternBody = trimmed.slice(1, lastSlashIndex);
    const flags = trimmed.slice(lastSlashIndex + 1);
    try {
      return new RegExp(patternBody, flags);
    } catch {
      // Fallback to standard glob if regex compilation fails
    }
  }

  // 2. Escape regex characters except * and ?
  // Characters to escape: . + ^ $ ( ) [ ] { } | \
  let regexString = trimmed
    .replace(/[.+^$()[\]{}|\\]/g, '\\$&') // escape special characters
    .replace(/\*/g, '.*')                 // convert * to .*
    .replace(/\?/g, '.');                 // convert ? to .

  // 3. If pattern does not specify a protocol/wildcard prefix, allow flexible path matching
  if (!trimmed.startsWith('*') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    regexString = '.*' + regexString;
  }
  if (!trimmed.endsWith('*')) {
    regexString = regexString + '.*';
  }

  return new RegExp(`^${regexString}$`, 'i');
}

/**
 * Tests whether a target URL matches a pattern.
 * Checks against both the full URL and the pathname (for relative/concise patterns).
 */
export function matchUrl(targetUrl: string, pattern: string): boolean {
  if (!pattern || !targetUrl) return false;

  const regex = globToRegex(pattern);

  // Test against full absolute URL (e.g. "https://api.github.com/users?page=1")
  if (regex.test(targetUrl)) {
    return true;
  }

  // Also test against just the pathname (e.g. "/users") for concise rule definitions
  try {
    const parsed = new URL(targetUrl, 'http://localhost');
    const pathnameAndSearch = parsed.pathname + parsed.search;
    if (regex.test(pathnameAndSearch) || regex.test(parsed.pathname)) {
      return true;
    }
  } catch {
    // If URL parsing fails, string match is sufficient
  }

  return false;
}

/**
 * Checks whether an HTTP method satisfies the rule's method filter.
 * 'ALL' matches any HTTP method.
 */
export function matchMethod(targetMethod: string, ruleMethod: HttpMethod): boolean {
  if (ruleMethod === 'ALL') return true;
  return targetMethod.toUpperCase() === ruleMethod.toUpperCase();
}

/**
 * Finds the first enabled mock rule matching the given URL and HTTP method.
 * Returns null if global mocking is disabled or no rule matches.
 */
export function findMatchingRule(
  url: string,
  method: string,
  rules: MockRule[],
  globalEnabled: boolean
): MockRule | null {
  if (!globalEnabled || !rules || rules.length === 0) {
    return null;
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (matchMethod(method, rule.method) && matchUrl(url, rule.urlPattern)) {
      return rule;
    }
  }

  return null;
}
