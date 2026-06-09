const ACTION_API_KEY = process.env.ACTION_API_KEY;
const {
  isArticleRouteAllowed,
  validateAndConsumeSessionCode
} = require('../services/sessionCodeService');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const sessionCode = req.headers['x-session-code'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();

    if (token === ACTION_API_KEY) {
      req.auth = {
        type: 'api_key'
      };
      return next();
    }
  }

  if (typeof sessionCode === 'string' && sessionCode.trim()) {
    if (!isArticleRouteAllowed(req.method, req.path)) {
      return res.err('FORBIDDEN', 'Session Code 仅允许访问文章相关接口', 403);
    }

    const validation = validateAndConsumeSessionCode(sessionCode.trim(), req.method, req.path);
    if (!validation.ok) {
      const statusCode = validation.code === 'FORBIDDEN' ? 403 : 401;
      return res.err(validation.code, validation.message, statusCode);
    }

    req.auth = {
      type: 'session_code',
      session: validation.session
    };
    return next();
  }

  return res.err('UNAUTHORIZED', 'API Key 或 Session Code 无效或缺失', 401);
};

module.exports = authMiddleware;
