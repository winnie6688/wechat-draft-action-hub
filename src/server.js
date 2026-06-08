require('dotenv').config();

const express = require('express');
const authMiddleware = require('./middleware/auth');
const articlesRouter = require('./routes/articles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 统一响应中间件
app.use((req, res, next) => {
  res.ok = (data = {}, message = 'success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      data,
      message
    });
  };

  res.err = (errorCode = 'SERVER_ERROR', message = 'Internal Server Error', statusCode = 500, data = undefined) => {
    const response = {
      success: false,
      error_code: errorCode,
      message
    };
    if (data !== undefined) {
      response.data = data;
    }
    return res.status(statusCode).json(response);
  };

  next();
});

app.use('/api', authMiddleware);
app.use('/api/articles', articlesRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;