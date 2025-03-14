const { createClient } = require('redis');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  async connect() {
    if (this.isConnected) {
      return this.client;
    }

    // If a connection attempt is already in progress, return that promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    try {
      this.connectionPromise = new Promise((resolve, reject) => {
        this.client = createClient({
          url: process.env.REDIS_URL || 'redis://default:password@localhost:6379'
        });

        this.client.on('error', (err) => {
          logger.error('Redis Error:', err);
          this.isConnected = false;
          reject(err);
        });

        this.client.on('connect', () => {
          logger.info('Redis client connected');
          this.isConnected = true;
          resolve(this.client);
        });

        this.client.connect().catch(reject);
      });

      return await this.connectionPromise;
    } catch (error) {
      logger.error('Redis connection error:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  async getClient() {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis client requested but not connected, attempting to connect');
      try {
        await this.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis on demand:', error);
        throw new Error('Redis client unavailable');
      }
    }
    return this.client;
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      this.connectionPromise = null;
      logger.info('Redis client disconnected');
    }
  }
}

module.exports = new RedisService();
