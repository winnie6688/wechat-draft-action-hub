const ACTION_API_KEY = process.env.ACTION_API_KEY;

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.err('UNAUTHORIZED', 'Unauthorized: Missing or invalid Authorization header', 401);
  }

  const token = authHeader.split(' ')[1];
  
  if (token !== ACTION_API_KEY) {
    return res.err('FORBIDDEN', 'Forbidden: Invalid API key', 403);
  }

  next();
};

module.exports = authMiddleware;