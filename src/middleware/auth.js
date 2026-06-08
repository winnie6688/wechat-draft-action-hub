const ACTION_API_KEY = process.env.ACTION_API_KEY;

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.err('UNAUTHORIZED', 'API Key 无效或缺失', 401);
  }

  const token = authHeader.split(' ')[1];
  
  if (token !== ACTION_API_KEY) {
    return res.err('UNAUTHORIZED', 'API Key 无效或缺失', 401);
  }

  next();
};

module.exports = authMiddleware;