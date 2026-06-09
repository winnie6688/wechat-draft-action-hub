const crypto = require('crypto');

const SESSION_CODE_TTL_MS = 30 * 60 * 1000;
const SESSION_CODE_MAX_USES = 20;

const ARTICLE_ROUTE_SCOPES = [
  { method: 'POST', pattern: /^\/articles$/ },
  { method: 'PATCH', pattern: /^\/articles\/[^/]+$/ },
  { method: 'GET', pattern: /^\/articles\/[^/]+\/check$/ },
  { method: 'POST', pattern: /^\/articles\/[^/]+\/upload-to-wechat$/ }
];

const sessionCodeStore = new Map();

const cleanupExpiredSessionCodes = () => {
  const now = Date.now();

  sessionCodeStore.forEach((session, code) => {
    if (session.expires_at <= now || session.used_count >= session.max_uses) {
      sessionCodeStore.delete(code);
    }
  });
};

const isArticleRouteAllowed = (method, path) => {
  return ARTICLE_ROUTE_SCOPES.some(scope => {
    return scope.method === method && scope.pattern.test(path);
  });
};

const generateSessionCodeValue = () => {
  const suffix = crypto.randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `SC-${suffix}`;
};

const createSessionCode = () => {
  cleanupExpiredSessionCodes();

  let sessionCode = generateSessionCodeValue();
  while (sessionCodeStore.has(sessionCode)) {
    sessionCode = generateSessionCodeValue();
  }

  const now = Date.now();
  const session = {
    session_code: sessionCode,
    created_at: now,
    expires_at: now + SESSION_CODE_TTL_MS,
    max_uses: SESSION_CODE_MAX_USES,
    used_count: 0,
    scope: 'articles_only'
  };

  sessionCodeStore.set(sessionCode, session);

  return {
    ...session,
    expires_in_seconds: Math.floor(SESSION_CODE_TTL_MS / 1000),
    allowed_routes: ARTICLE_ROUTE_SCOPES.map(scope => `${scope.method} ${scope.pattern.source}`)
  };
};

const validateAndConsumeSessionCode = (sessionCode, method, path) => {
  cleanupExpiredSessionCodes();

  if (!sessionCode) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Session Code 缺失' };
  }

  const session = sessionCodeStore.get(sessionCode);
  if (!session) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Session Code 无效、已过期或已耗尽' };
  }

  if (!isArticleRouteAllowed(method, path)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Session Code 仅允许访问文章相关接口' };
  }

  if (session.expires_at <= Date.now()) {
    sessionCodeStore.delete(sessionCode);
    return { ok: false, code: 'UNAUTHORIZED', message: 'Session Code 已过期' };
  }

  if (session.used_count >= session.max_uses) {
    sessionCodeStore.delete(sessionCode);
    return { ok: false, code: 'UNAUTHORIZED', message: 'Session Code 使用次数已达上限' };
  }

  session.used_count += 1;
  session.last_used_at = Date.now();

  return {
    ok: true,
    session: {
      session_code: session.session_code,
      expires_at: session.expires_at,
      max_uses: session.max_uses,
      used_count: session.used_count,
      remaining_uses: Math.max(session.max_uses - session.used_count, 0),
      scope: session.scope
    }
  };
};

module.exports = {
  ARTICLE_ROUTE_SCOPES,
  SESSION_CODE_MAX_USES,
  SESSION_CODE_TTL_MS,
  createSessionCode,
  isArticleRouteAllowed,
  validateAndConsumeSessionCode
};
