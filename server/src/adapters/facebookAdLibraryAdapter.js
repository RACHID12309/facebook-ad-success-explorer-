// src/adapters/facebookAdLibraryAdapter.js
const axios = require('axios');
const { promisify } = require('util');
const redis = require('../services/redis');
const logger = require('../utils/logger');
const { calculateBackoff } = require('../utils/rateLimiter');

class FacebookAdLibraryAdapter {
  constructor(config) {
    this.apiVersion = config.apiVersion || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/ads_archive`;
    this.accessToken = config.accessToken;
    this.redisClient = redis.getClient();
    this.rateLimitWindow = {
      requests: 0,
      resetTime: Date.now() + 3600000, // 1 hour window
      maxRequests: 1000 // Adjust based on your rate limits
    };
  }

  /**
   * Search for ads based on keywords and filters
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchAds(params) {
    const cacheKey = `fb_ads_${JSON.stringify(params)}`;
    
    // Try to get from cache first
    const cachedData = await this.redisClient.get(cacheKey);
    if (cachedData) {
      logger.info('Cache hit for ad search');
      return JSON.parse(cachedData);
    }
    
    // Check rate limits before proceeding
    await this.checkRateLimits();
    
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          access_token: this.accessToken,
          search_terms: params.keywords,
          ad_type: 'POLITICAL_AND_ISSUE_ADS',
          ad_reached_countries: params.countries || ['US'],
          ad_active_status: 'ALL',
          fields: [
            'id',
            'ad_creation_time',
            'ad_creative_bodies',
            'ad_creative_link_titles',
            'ad_creative_link_descriptions',
            'ad_creative_link_captions',
            'ad_delivery_start_time',
            'ad_delivery_stop_time',
            'ad_snapshot_url',
            'page_id',
            'page_name',
            'demographic_distribution',
            'region_distribution',
            'impressions',
            'spend'
          ].join(','),
          limit: params.limit || 25
        }
      });
      
      // Update rate limit counter
      this.rateLimitWindow.requests++;
      
      // Cache the results
      await this.redisClient.set(
        cacheKey, 
        JSON.stringify(response.data),
        'EX',
        3600 // Cache for 1 hour
      );
      
      return response.data;
    } catch (error) {
      // Handle rate limiting errors
      if (error.response && error.response.status === 429) {
        logger.warn('Rate limit exceeded for Facebook Ad Library API');
        
        // Apply exponential backoff
        const backoffTime = calculateBackoff(error.response.headers['retry-after'] || 30);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry the request
        return this.searchAds(params);
      }
      
      logger.error('Error fetching ads from Facebook Ad Library', error);
      throw error;
    }
  }
  
  /**
   * Get detailed information about a specific ad
   * @param {string} adId - Facebook Ad ID
   * @returns {Promise<Object>} - Ad details
   */
  async getAdDetails(adId) {
    const cacheKey = `fb_ad_${adId}`;
    
    // Try to get from cache first
    const cachedData = await this.redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    // Check rate limits
    await this.checkRateLimits();
    
    try {
      const response = await axios.get(`${this.baseUrl}/${adId}`, {
        params: {
          access_token: this.accessToken,
          fields: [
            'id',
            'ad_creation_time',
            'ad_creative_bodies',
            'ad_creative_link_titles',
            'ad_creative_link_descriptions',
            'ad_creative_link_captions',
            'ad_delivery_start_time',
            'ad_delivery_stop_time',
            'ad_snapshot_url',
            'page_id',
            'page_name',
            'demographic_distribution',
            'region_distribution',
            'impressions',
            'spend'
          ].join(',')
        }
      });
      
      // Update rate limit counter
      this.rateLimitWindow.requests++;
      
      // Cache the results
      await this.redisClient.set(
        cacheKey, 
        JSON.stringify(response.data),
        'EX',
        86400 // Cache for 24 hours (longer since individual ad details change less frequently)
      );
      
      return response.data;
    } catch (error) {
      logger.error(`Error fetching ad details for ID ${adId}`, error);
      throw error;
    }
  }
  
  /**
   * Check and manage rate limits
   * @private
   */
  async checkRateLimits() {
    // Reset counter if the window has passed
    if (Date.now() > this.rateLimitWindow.resetTime) {
      this.rateLimitWindow.requests = 0;
      this.rateLimitWindow.resetTime = Date.now() + 3600000; // Reset for next hour
    }
    
    // If we're approaching the limit, apply backoff
    if (this.rateLimitWindow.requests >= this.rateLimitWindow.maxRequests * 0.9) {
      logger.warn('Approaching rate limit, applying backoff');
      const timeToWait = this.rateLimitWindow.resetTime - Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.min(timeToWait, 30000))); // Wait at most 30 seconds
    }
  }
}

module.exports = FacebookAdLibraryAdapter;