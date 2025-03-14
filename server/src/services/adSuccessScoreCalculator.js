// src/services/adSuccessScoreCalculator.js
const mongoose = require('mongoose');
const AdScoreModel = require('../models/adScore');
const logger = require('../utils/logger');

class AdSuccessScoreCalculator {
  /**
   * Calculate success score for an ad based on multiple metrics
   * @param {Object} adData - Raw ad data from Facebook Ad Library API
   * @returns {Object} - Ad data with success score and component metrics
   */
  async calculateScore(adData) {
    try {
      // First check if we already have calculated this ad's score in the database
      const existingScore = await AdScoreModel.findOne({ adId: adData.id });
      
      if (existingScore && existingScore.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        logger.info(`Using cached score for ad ${adData.id}`);
        return {
          ...adData,
          successScore: existingScore.totalScore,
          componentScores: existingScore.componentScores
        };
      }
      
      // Extract relevant metrics for scoring
      const metrics = this.extractMetrics(adData);
      
      // Calculate component scores
      const componentScores = {
        durationScore: this.calculateDurationScore(metrics.durationDays),
        spendScore: this.calculateSpendScore(metrics.spendAmount),
        impressionsScore: this.calculateImpressionsScore(metrics.impressions),
        engagementScore: this.calculateEngagementScore(metrics)
      };
      
      // Calculate total weighted score (0-100)
      const totalScore = this.calculateTotalScore(componentScores);
      
      // Store the score in the database for future use
      await AdScoreModel.findOneAndUpdate(
        { adId: adData.id },
        {
          adId: adData.id,
          totalScore,
          componentScores,
          rawMetrics: metrics,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Return the enriched ad data
      return {
        ...adData,
        successScore: totalScore,
        componentScores
      };
    } catch (error) {
      logger.error(`Error calculating success score for ad ${adData.id}`, error);
      // Return original data with default score
      return {
        ...adData,
        successScore: 0,
        componentScores: {
          durationScore: 0,
          spendScore: 0,
          impressionsScore: 0,
          engagementScore: 0
        }
      };
    }
  }
  
  /**
   * Extract relevant metrics from the ad data
   * @param {Object} adData - Raw ad data
   * @returns {Object} - Extracted metrics
   * @private
   */
  extractMetrics(adData) {
    // Calculate ad duration
    const startTime = new Date(adData.ad_delivery_start_time);
    const endTime = adData.ad_delivery_stop_time ? new Date(adData.ad_delivery_stop_time) : new Date();
    const durationDays = Math.max(1, Math.round((endTime - startTime) / (1000 * 60 * 60 * 24)));
    
    // Parse spend range into average spend amount
    const spendAmount = this.parseSpendRange(adData.spend);
    
    // Parse impressions range into average impressions
    const impressions = this.parseImpressionRange(adData.impressions);
    
    // Calculate estimated engagement (Note: FB Ad Library doesn't provide direct engagement metrics)
    // We'll use proxy indicators and estimates based on available data
    const estimatedEngagement = this.estimateEngagement(adData, impressions);
    
    return {
      durationDays,
      spendAmount,
      impressions,
      estimatedEngagement,
      // Calculate daily averages
      dailySpend: spendAmount / durationDays,
      dailyImpressions: impressions / durationDays
    };
  }
  
  /**
   * Parse spend range into a single numeric value
   * @param {string} spendRange - Spend range from API (e.g., "100-499")
   * @returns {number} - Average spend amount
   * @private
   */
  parseSpendRange(spendRange) {
    if (!spendRange) return 0;
    
    try {
      // Handle ranges like "100-499" or "<100" or ">1000"
      if (spendRange.includes('-')) {
        const [min, max] = spendRange.split('-').map(val => parseInt(val.replace(/[^\d]/g, ''), 10));
        return (min + max) / 2;
      } else if (spendRange.includes('<')) {
        return parseInt(spendRange.replace(/[^\d]/g, ''), 10) / 2;
      } else if (spendRange.includes('>')) {
        return parseInt(spendRange.replace(/[^\d]/g, ''), 10) * 1.5;
      } else {
        return parseInt(spendRange.replace(/[^\d]/g, ''), 10);
      }
    } catch (error) {
      logger.warn(`Could not parse spend range: ${spendRange}`, error);
      return 0;
    }
  }
  
  /**
   * Parse impression range into a single numeric value
   * @param {string} impressionRange - Impression range from API
   * @returns {number} - Average impressions
   * @private
   */
  parseImpressionRange(impressionRange) {
    // Similar logic to parseSpendRange
    return this.parseSpendRange(impressionRange);
  }
  
  /**
   * Estimate engagement based on available proxy indicators
   * @param {Object} adData - Raw ad data
   * @param {number} impressions - Parsed impressions
   * @returns {number} - Estimated engagement
   * @private
   */
  estimateEngagement(adData, impressions) {
    // Since Facebook Ad Library doesn't provide direct engagement metrics,
    // we need to use proxy indicators and industry benchmarks
    
    // Factor 1: Ad duration - longer running ads likely have better engagement
    const durationFactor = Math.min(1.5, 1 + (this.extractMetrics(adData).durationDays / 30) * 0.5);
    
    // Factor 2: Demographic distribution - wider distribution might indicate better targeting
    const demographicFactor = adData.demographic_distribution ? 
      Math.min(1.2, 1 + (adData.demographic_distribution.length / 10) * 0.2) : 1;
    
    // Factor 3: Content length and complexity
    const contentFactor = adData.ad_creative_bodies ? 
      Math.min(1.3, 1 + (adData.ad_creative_bodies.join(' ').length / 500) * 0.3) : 1;
    
    // Apply industry average CTR as baseline (around 1%)
    const avgCTR = 0.01;
    
    // Estimated clicks based on impressions and adjusted CTR
    const estimatedClicks = impressions * avgCTR * durationFactor * demographicFactor * contentFactor;
    
    // Add estimated post engagements (reactions, comments, shares) based on clicks
    // Industry average is about 2-3 post engagements per click
    const postEngagementRatio = 2.5;
    const estimatedPostEngagements = estimatedClicks * postEngagementRatio;
    
    return estimatedClicks + estimatedPostEngagements;
  }
  
  /**
   * Calculate duration score component (0-25)
   * @param {number} durationDays - Ad duration in days
   * @returns {number} - Duration score
   * @private
   */
  calculateDurationScore(durationDays) {
    // Longer-running ads are usually more successful
    // Scale: 0-25 points
    // Logic: 7 days = 5 points, 14 days = 10 points, 30 days = 15 points, 60+ days = 25 points
    if (durationDays >= 60) return 25;
    if (durationDays >= 30) return 15 + ((durationDays - 30) / 30) * 10;
    if (durationDays >= 14) return 10 + ((durationDays - 14) / 16) * 5;
    if (durationDays >= 7) return 5 + ((durationDays - 7) / 7) * 5;
    return Math.max(0, (durationDays / 7) * 5);
  }
  
  /**
   * Calculate spend score component (0-25)
   * @param {number} spendAmount - Ad spend amount
   * @returns {number} - Spend score
   * @private
   */
  calculateSpendScore(spendAmount) {
    // Higher spend can indicate more successful ads (advertisers often scale budget for winners)
    // Scale: 0-25 points
    // Logic: $100 = 5 points, $500 = 10 points, $1000 = 15 points, $5000+ = 25 points
    if (spendAmount >= 5000) return 25;
    if (spendAmount >= 1000) return 15 + ((spendAmount - 1000) / 4000) * 10;
    if (spendAmount >= 500) return 10 + ((spendAmount - 500) / 500) * 5;
    if (spendAmount >= 100) return 5 + ((spendAmount - 100) / 400) * 5;
    return Math.max(0, (spendAmount / 100) * 5);
  }
  
  /**
   * Calculate impressions score component (0-25)
   * @param {number} impressions - Ad impressions
   * @returns {number} - Impressions score
   * @private
   */
  calculateImpressionsScore(impressions) {
    // Higher impressions volume indicates successful reach
    // Scale: 0-25 points
    // Logic: 10K = 5 points, 50K = 10 points, 100K = 15 points, 500K+ = 25 points
    if (impressions >= 500000) return 25;
    if (impressions >= 100000) return 15 + ((impressions - 100000) / 400000) * 10;
    if (impressions >= 50000) return 10 + ((impressions - 50000) / 50000) * 5;
    if (impressions >= 10000) return 5 + ((impressions - 10000) / 40000) * 5;
    return Math.max(0, (impressions / 10000) * 5);
  }
  
  /**
   * Calculate engagement score component (0-25)
   * @param {Object} metrics - Extracted metrics including estimated engagement
   * @returns {number} - Engagement score
   * @private
   */
  calculateEngagementScore(metrics) {
    // Higher engagement ratio indicates more compelling ad content
    // Scale: 0-25 points
    
    // Calculate engagement rate (engagement/impressions)
    const engagementRate = metrics.impressions > 0 ? 
      metrics.estimatedEngagement / metrics.impressions : 0;
    
    // Industry average engagement rate is around 3-5%
    if (engagementRate >= 0.10) return 25; // 10%+ is excellent
    if (engagementRate >= 0.05) return 15 + ((engagementRate - 0.05) / 0.05) * 10; // 5-10%
    if (engagementRate >= 0.03) return 10 + ((engagementRate - 0.03) / 0.02) * 5; // 3-5%
    if (engagementRate >= 0.01) return 5 + ((engagementRate - 0.01) / 0.02) * 5; // 1-3%
    return Math.max(0, (engagementRate / 0.01) * 5); // 0-1%
  }
  
  /**
   * Calculate total weighted score
   * @param {Object} componentScores - Individual component scores
   * @returns {number} - Total weighted score (0-100)
   * @private
   */
  calculateTotalScore(componentScores) {
    // We can apply different weights to different components based on importance
    // Current weights: Duration (30%), Spend (20%), Impressions (20%), Engagement (30%)
    const weightedScore = (
      (componentScores.durationScore * 1.2) +     // 25 * 1.2 = 30 max points
      (componentScores.spendScore * 0.8) +        // 25 * 0.8 = 20 max points
      (componentScores.impressionsScore * 0.8) +  // 25 * 0.8 = 20 max points
      (componentScores.engagementScore * 1.2)     // 25 * 1.2 = 30 max points
    );
    
    // Return rounded score
    return Math.round(weightedScore);
  }
}

module.exports = new AdSuccessScoreCalculator();