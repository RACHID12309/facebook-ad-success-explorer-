const { createClient } = require('redis');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return this.client;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://default:password@localhost:6379'
      });

      this.client.on('error', (err) => {
        logger.error('Redis Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Redis connection error:', error);
      throw error;
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis client requested but not connected, attempting to connect');
      this.connect();
    }
    return this.client;
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }
}

module.exports = new RedisService();