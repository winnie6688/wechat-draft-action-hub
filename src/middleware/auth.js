const ACTION_API_KEY = process.env.ACTION_API_KEY;

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid Authorization header'
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (token !== ACTION_API_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid API key'
    });
  }

  next();
};

module.exports = authMiddleware;