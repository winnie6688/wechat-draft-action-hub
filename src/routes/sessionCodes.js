const express = require('express');
const {
  createSessionCode,
  SESSION_CODE_MAX_USES,
  SESSION_CODE_TTL_MS
} = require('../services/sessionCodeService');

const router = express.Router();

router.post('/', (req, res) => {
  if (!req.auth || req.auth.type !== 'api_key') {
    return res.err('FORBIDDEN', '仅允许使用固定 API Key 生成 Session Code', 403);
  }

  const session = createSessionCode();

  return res.ok({
    session_code: session.session_code,
    expires_in_seconds: session.expires_in_seconds,
    expires_in_minutes: Math.floor(SESSION_CODE_TTL_MS / 60000),
    max_uses: SESSION_CODE_MAX_USES,
    remaining_uses: SESSION_CODE_MAX_USES,
    scope: 'articles_only',
    allowed_routes: [
      'POST /api/articles',
      'PATCH /api/articles/:record_id',
      'GET /api/articles/:record_id/check',
      'POST /api/articles/:record_id/upload-to-wechat'
    ]
  }, 'Session Code 已生成', 201);
});

module.exports = router;
