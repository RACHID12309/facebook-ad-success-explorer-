require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const redis = require('./services/redis');
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://admin:password@localhost:27017/ad_explorer?authSource=admin');
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to Redis
const connectRedis = async () => {
  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (error) {
    logger.error('Redis connection error:', error);
    // Continue even if Redis fails
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
  await connectDB();
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