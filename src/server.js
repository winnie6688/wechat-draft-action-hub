require('dotenv').config();

const express = require('express');
const authMiddleware = require('./middleware/auth');
const articlesRouter = require('./routes/articles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', authMiddleware);
app.use('/api/articles', articlesRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;