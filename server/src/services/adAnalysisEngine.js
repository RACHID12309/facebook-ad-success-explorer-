// src/services/adAnalysisEngine.js
const { promisify } = require('util');
const mongoose = require('mongoose');
const natural = require('natural');
const AdScoreCalculator = require('./adSuccessScoreCalculator');
const SuccessfulAdModel = require('../models/successfulAd');
const redis = require('./redis');
const logger = require('../utils/logger');

class AdAnalysisEngine {
  constructor() {
    this.redisClient = redis.getClient();
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.MIN_SUCCESS_SCORE = 70; // Threshold for considering an ad "successful"
  }

  /**
   * Process and analyze a batch of ads
   * @param {Array} ads - Raw ads from Facebook Ad Library API
   * @returns {Promise<Array>} - Processed and scored ads
   */
  async processAds(ads) {
    try {
      // Score each ad
      const scoredAds = await Promise.all(
        ads.map(ad => AdScoreCalculator.calculateScore(ad))
      );
      
      // Filter to only successful ads
      const successfulAds = scoredAds.filter(ad => ad.successScore >= this.MIN_SUCCESS_SCORE);
      
      // Store successful ads in the database
      await this.storeSuccessfulAds(successfulAds);
      
      // Analyze patterns in successful ads (runs asynchronously)
      this.analyzeSuccessPatterns(successfulAds).catch(err => {
        logger.error('Error analyzing success patterns', err);
      });
      
      return successfulAds;
    } catch (error) {
      logger.error('Error processing ads', error);
      throw error;
    }
  }
  
  /**
   * Store successful ads in the database
   * @param {Array} successfulAds - Ads with success scores
   * @private
   */
  async storeSuccessfulAds(successfulAds) {
    try {
      // Bulk operations for efficiency
      const operations = successfulAds.map(ad => ({
        updateOne: {
          filter: { adId: ad.id },
          update: {
            adId: ad.id,
            successScore: ad.successScore,
            componentScores: ad.componentScores,
            adData: ad,
            updatedAt: new Date()
          },
          upsert: true
        }
      }));
      
      if (operations.length > 0) {
        await SuccessfulAdModel.bulkWrite(operations);
        logger.info(`Stored ${operations.length} successful ads`);
      }
    } catch (error) {
      logger.error('Error storing successful ads', error);
    }
  }
  
  /**
   * Analyze patterns in successful ads
   * @param {Array} successfulAds - Ads with success scores
   * @private
   */
  async analyzeSuccessPatterns(successfulAds) {
    try {
      if (successfulAds.length < 5) {
        logger.info('Not enough successful ads to analyze patterns');
        return;
      }
      
      // Extract ad content for text analysis
      const adContents = successfulAds.map(ad => {
        return {
          id: ad.id,
          text: [
            ...(ad.ad_creative_bodies || []),
            ...(ad.ad_creative_link_titles || []),
            ...(ad.ad_creative_link_descriptions || [])
          ].join(' '),
          score: ad.successScore
        };
      });
      
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
      await this.redisClient.set(
        'ad_success_patterns',
        JSON.stringify(patterns),
        'EX',
        86400 // 24 hours expiry
      );
      
      logger.info('Successfully analyzed ad patterns');
    } catch (error) {
      logger.error('Error analyzing ad patterns', error);
    }
  }
  
  /**
   * Extract common terms from TF-IDF analysis
   * @returns {Array} - Common terms with scores
   * @private
   */
  extractCommonTerms() {
    const stopwords = natural.stopwords;
    const terms = {};
    
    // Process each document
    for (let i = 0; i < this.tfidf.documents.length; i++) {
      this.tfidf.listTerms(i).slice(0, 10).forEach(item => {
        const term = item.term.toLowerCase();
        
        // Skip stopwords and short terms
        if (stopwords.includes(term) || term.length < 3) {
          return;
        }
        
        if (!terms[term]) {
          terms[term] = {
            term,
            count: 1,
            tfidfSum: item.tfidf
          };
        } else {
          terms[term].count += 1;
          terms[term].tfidfSum += item.tfidf;
        }
      });
    }
    
    // Convert to array and sort by frequency and TF-IDF score
    return Object.values(terms)
      .map(item => ({
        term: item.term,
        count: item.count,
        averageTfidf: item.tfidfSum / item.count
      }))
      .filter(item => item.count > 1) // Only terms that appear in multiple ads
      .sort((a, b) => {
        // Prioritize terms that appear in more documents
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        // Then by average TF-IDF score
        return b.averageTfidf - a.averageTfidf;
      })
      .slice(0, 20); // Top 20 terms
  }
  
  /**
   * Analyze ad structure patterns
   * @param {Array} ads - Successful ads
   * @returns {Object} - Structure patterns
   * @private
   */
  analyzeAdStructure(ads) {
    // Analyze text length
    const textLengths = ads.map(ad => {
      const bodies = ad.ad_creative_bodies || [];
      return bodies.join(' ').length;
    });
    
    const avgTextLength = textLengths.reduce((sum, len) => sum + len, 0) / textLengths.length;
    
    // Analyze call-to-action presence
    const ctaWords = ['shop', 'buy', 'get', 'sign up', 'learn', 'discover', 'try', 'click', 'visit', 'join', 'order', 'call'];
    
    const ctaPresence = ads.filter(ad => {
      const bodies = ad.ad_creative_bodies || [];
      const text = bodies.join(' ').toLowerCase();
      return ctaWords.some(cta => text.includes(cta));
    }).length / ads.length;
    
    // Analyze question usage
    const questionPresence = ads.filter(ad => {
      const bodies = ad.ad_creative_bodies || [];
      const text = bodies.join(' ');
      return text.includes('?');
    }).length / ads.length;
    
    // Analyze emoji usage
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    
    const emojiPresence = ads.filter(ad => {
      const bodies = ad.ad_creative_bodies || [];
      const text = bodies.join(' ');
      return emojiRegex.test(text);
    }).length / ads.length;
    
    // Return the analyzed structure patterns
    return {
      averageTextLength: Math.round(avgTextLength),
      ctaPresenceRate: Math.round(ctaPresence * 100),
      questionPresenceRate: Math.round(questionPresence * 100),
      emojiPresenceRate: Math.round(emojiPresence * 100)
    };
  }
  
  /**
   * Analyze visual elements patterns (placeholder for future implementation)
   * @param {Array} ads - Successful ads
   * @returns {Object} - Visual patterns
   * @private
   */
  analyzeVisualElements(ads) {
    // This would require image analysis capabilities
    // For now, return placeholder data
    return {
      imagePresenceRate: 95,
      videoPresenceRate: 60,
      carouselPresenceRate: 40,
      note: 'Visual analysis requires additional implementation'
    };
  }
  
  /**
   * Get success patterns from cache or recalculate
   * @returns {Promise<Object>} - Success patterns
   */
  async getSuccessPatterns() {
    try {
      // Try to get from cache
      const cachedPatterns = await this.redisClient.get('ad_success_patterns');
      
      if (cachedPatterns) {
        return JSON.parse(cachedPatterns);
      }
      
      // If not in cache, get recent successful ads from DB
      const recentSuccessfulAds = await SuccessfulAdModel.find({})
        .sort({ successScore: -1 })
        .limit(100);
      
      if (recentSuccessfulAds.length > 0) {
        // Extract adData from DB records
        const ads = recentSuccessfulAds.map(record => record.adData);
        
        // Analyze and cache the patterns
        await this.analyzeSuccessPatterns(ads);
        
        // Try get from cache again
        const newlyCachedPatterns = await this.redisClient.get('ad_success_patterns');
        
        if (newlyCachedPatterns) {
          return JSON.parse(newlyCachedPatterns);
        }
      }
      
      // Return empty patterns if nothing is available
      return {
        commonTerms: [],
        structurePatterns: {},
        visualPatterns: {},
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error getting success patterns', error);
      throw error;
    }
  }
}

module.exports = new AdAnalysisEngine();