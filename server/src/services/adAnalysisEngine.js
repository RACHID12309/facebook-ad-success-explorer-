// Partial fix for src/services/adAnalysisEngine.js
// Focus on the problematic analyzeSuccessPatterns method

  /**
   * Analyze patterns in successful ads
   * @param {Array} successfulAds - Ads with success scores
   * @private
   */
  async analyzeSuccessPatterns(successfulAds) {
    try {
      // Validate input
      if (!successfulAds || !Array.isArray(successfulAds) || successfulAds.length < 5) {
        logger.info('Not enough successful ads to analyze patterns');
        return;
      }
      
      // Extract ad content for text analysis
      const adContents = successfulAds.map(ad => {
        return {
          id: ad.id,
          text: [
            ...(Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies : []),
            ...(Array.isArray(ad.ad_creative_link_titles) ? ad.ad_creative_link_titles : []),
            ...(Array.isArray(ad.ad_creative_link_descriptions) ? ad.ad_creative_link_descriptions : [])
          ].filter(Boolean).join(' '),
          score: ad.successScore || 0
        };
      }).filter(content => content.text && content.text.trim().length > 0);
      
      if (adContents.length < 5) {
        logger.info('Not enough ad content to analyze patterns after filtering');
        return;
      }
      
      // Perform TF-IDF analysis to find important keywords
      this.tfidf = new natural.TfIdf();
      adContents.forEach(content => {
        this.tfidf.addDocument(content.text);
      });
      
      // Extract top terms across all documents
      const commonTerms = this.extractCommonTerms();
      
      // Find patterns in ad structure
      const structurePatterns = this.analyzeAdStructure(successfulAds);
      
      // Find patterns in visual elements (placeholder for future implementation)
      const visualPatterns = this.analyzeVisualElements(successfulAds);
      
      // Combine all patterns
      const patterns = {
        commonTerms,
        structurePatterns,
        visualPatterns,
        updatedAt: new Date()
      };
      
      // Store the patterns in Redis for quick access
      try {
        const redisClient = await this.redisClient;
        await redisClient.set(
          'ad_success_patterns',
          JSON.stringify(patterns),
          'EX',
          86400 // 24 hours expiry
        );
      } catch (redisError) {
        logger.warn('Could not cache patterns in Redis', redisError);
      }
      
      logger.info('Successfully analyzed ad patterns');
      return patterns;
    } catch (error) {
      logger.error('Error analyzing ad patterns', error);
      throw error;
    }
  }
  
  /**
   * Analyze ad structure patterns
   * @param {Array} ads - Successful ads
   * @returns {Object} - Structure patterns
   * @private
   */
  analyzeAdStructure(ads) {
    if (!ads || !Array.isArray(ads) || ads.length === 0) {
      return {
        averageTextLength: 0,
        ctaPresenceRate: 0,
        questionPresenceRate: 0,
        emojiPresenceRate: 0
      };
    }
    
    // Analyze text length
    const textLengths = ads.map(ad => {
      const bodies = Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies : [];
      return bodies.join(' ').length;
    }).filter(length => length > 0);
    
    const avgTextLength = textLengths.length > 0 ? 
      textLengths.reduce((sum, len) => sum + len, 0) / textLengths.length : 0;
    
    // Analyze call-to-action presence
    const ctaWords = ['shop', 'buy', 'get', 'sign up', 'learn', 'discover', 'try', 'click', 'visit', 'join', 'order', 'call'];
    
    const ctaPresence = ads.filter(ad => {
      const bodies = Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies : [];
      const text = bodies.join(' ').toLowerCase();
      return ctaWords.some(cta => text.includes(cta));
    }).length / Math.max(1, ads.length);
    
    // Analyze question usage
    const questionPresence = ads.filter(ad => {
      const bodies = Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies : [];
      const text = bodies.join(' ');
      return text.includes('?');
    }).length / Math.max(1, ads.length);
    
    // Improved emoji regex that covers more emoji characters
    const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu;
    
    const emojiPresence = ads.filter(ad => {
      const bodies = Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies : [];
      const text = bodies.join(' ');
      return emojiRegex.test(text);
    }).length / Math.max(1, ads.length);
    
    // Return the analyzed structure patterns
    return {
      averageTextLength: Math.round(avgTextLength),
      ctaPresenceRate: Math.round(ctaPresence * 100),
      questionPresenceRate: Math.round(questionPresence * 100),
      emojiPresenceRate: Math.round(emojiPresence * 100)
    };
  }
