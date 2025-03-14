require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const redis = require('./services/redis');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  logger.info('Created logs directory');
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://admin:password@localhost:27017/ad_explorer?authSource=admin');
    logger.info('MongoDB connected');
    return true;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    return false;
  }
};

// Connect to Redis
const connectRedis = async () => {
  try {
    await redis.connect();
    logger.info('Redis connected');
    return true;
  } catch (error) {
    logger.error('Redis connection error:', error);
    logger.warn('Application will continue without Redis caching');
    return false;
  }
};

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Import API routes
app.use('/api/ads', require('./routes/ads'));

// Start server
const startServer = async () => {
  // MongoDB connection is critical - don't start if it fails
  const dbConnected = await connectDB();
  if (!dbConnected) {
    logger.error('Failed to connect to MongoDB. Application cannot start.');
    process.exit(1);
  }
  
  // Redis connection is helpful but not critical
  await connectRedis();
  
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
