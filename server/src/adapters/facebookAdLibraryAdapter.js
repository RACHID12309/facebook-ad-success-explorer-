// Partial fix for src/adapters/facebookAdLibraryAdapter.js
// Focus on the searchAds method

  /**
   * Search for ads based on keywords and filters
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Search results
   */
  async searchAds(params) {
    if (!params || !params.keywords) {
      throw new Error('Keywords are required for ad search');
    }

    const cacheKey = `fb_ads_${JSON.stringify(params)}`;
    
    // Try to get from cache first
    try {
      const redisClient = await this.redisClient;
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info('Cache hit for ad search');
        return JSON.parse(cachedData);
      }
    } catch (redisError) {
      logger.warn('Redis error when fetching cache', redisError);
      // Continue with API call if cache fails
    }
    
    // Check rate limits before proceeding
    await this.checkRateLimits();
    
    try {
      // Convert country parameter to array if needed
      const countries = params.countries ? 
        (Array.isArray(params.countries) ? params.countries : [params.countries]) : 
        ['US'];
      
      const response = await axios.get(this.baseUrl, {
        params: {
          access_token: this.accessToken,
          search_terms: params.keywords,
          ad_type: params.adType || 'ALL', // Allow flexible ad types instead of hardcoding
          ad_reached_countries: countries,
          ad_active_status: params.activeStatus || 'ALL',
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
          limit: Math.min(1000, params.limit || 25) // Cap limit at 1000 to prevent abuse
        },
        timeout: 30000 // 30-second timeout for API calls
      });
      
      // Validate response data
      if (!response.data || !Array.isArray(response.data.data)) {
        logger.warn('Invalid response format from Facebook Ad API', { 
          responseStatus: response.status,
          responseData: typeof response.data 
        });
        
        // Return a default structure to prevent errors
        return { data: [], paging: {} };
      }
      
      // Update rate limit counter
      this.rateLimitWindow.requests++;
      
      // Cache the results
      try {
        await this.redisClient.set(
          cacheKey, 
          JSON.stringify(response.data),
          'EX',
          3600 // Cache for 1 hour
        );
      } catch (cacheError) {
        logger.warn('Failed to cache Facebook Ad API results', cacheError);
        // Continue even if caching fails
      }
      
      return response.data;
    } catch (error) {
      // Handle rate limiting errors
      if (error.response && error.response.status === 429) {
        logger.warn('Rate limit exceeded for Facebook Ad Library API');
        
        // Apply exponential backoff
        const retryAfter = error.response.headers['retry-after'] || 30;
        const backoffTime = calculateBackoff(retryAfter);
        
        logger.info(`Backing off for ${backoffTime}ms before retrying`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry the request
        return this.searchAds(params);
      }
      
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        logger.error('Facebook Ad API authentication failed - check your access token');
        throw new Error('Authentication failed with Facebook Ad API');
      }
      
      // Handle other errors
      logger.error('Error fetching ads from Facebook Ad Library', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw error;
    }
  }
