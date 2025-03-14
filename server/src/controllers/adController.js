// src/controllers/adController.js
const FacebookAdLibraryAdapter = require('../adapters/facebookAdLibraryAdapter');
const AdAnalysisEngine = require('../services/adAnalysisEngine');
const SuccessfulAdModel = require('../models/successfulAd');
const logger = require('../utils/logger');

// Initialize Facebook Ad Library adapter
const fbAdapter = new FacebookAdLibraryAdapter({
  apiVersion: process.env.FB_API_VERSION,
  accessToken: process.env.FB_ACCESS_TOKEN
});

/**
 * Search for successful ads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchSuccessfulAds = async (req, res) => {
  try {
    const { keywords, minScore = 70, limit = 25, page = 1 } = req.query;
    
    // Validate input
    if (!keywords) {
      return res.status(400).json({ error: 'Keywords are required for search' });
    }
    
    // Search Facebook Ad Library
    const fbResults = await fbAdapter.searchAds({
      keywords,
      limit: Math.min(100, parseInt(limit) * 2), // Fetch more to allow for filtering
      page: parseInt(page)
    });
    
    // Validate API response
    if (!fbResults || !Array.isArray(fbResults.data)) {
      logger.warn('Invalid response from Facebook Ad Library API', { fbResults });
      return res.status(502).json({ 
        error: 'Invalid response from Facebook Ad API',
        details: 'The external API returned an unexpected format'
      });
    }
    
    // Process and score the ads
    const successfulAds = await AdAnalysisEngine.processAds(fbResults.data);
    
    // Filter by minimum success score
    const filteredAds = successfulAds.filter(ad => ad.successScore >= parseInt(minScore));
    
    // Paginate results
    const paginatedAds = filteredAds.slice(0, parseInt(limit));
    
    // Return the results
    res.json({
      success: true,
      data: paginatedAds,
      pagination: {
        total: filteredAds.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(filteredAds.length / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error searching for successful ads', error);
    res.status(500).json({ 
      error: 'Error searching for ads',
      message: error.message
    });
  }
};

/**
 * Get details of a specific ad
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAdDetails = async (req, res) => {
  try {
    const { adId } = req.params;
    
    // Validate input
    if (!adId) {
      return res.status(400).json({ error: 'Ad ID is required' });
    }
    
    // Try to get from database first (for successful ads)
    const storedAd = await SuccessfulAdModel.findOne({ adId });
    
    if (storedAd) {
      return res.json({
        success: true,
        data: storedAd.adData,
        source: 'database'
      });
    }
    
    // If not in database, fetch from Facebook
    const adDetails = await fbAdapter.getAdDetails(adId);
    
    // Validate API response
    if (!adDetails || !adDetails.id) {
      return res.status(404).json({ 
        error: 'Ad not found',
        details: 'The requested ad could not be found or has been removed'
      });
    }
    
    // Score the ad
    const scoredAd = await AdAnalysisEngine.processAds([adDetails]);
    
    res.json({
      success: true,
      data: scoredAd[0] || adDetails,
      source: 'api'
    });
  } catch (error) {
    logger.error(`Error fetching ad details for ID ${req.params.adId}`, error);
    res.status(error.response?.status || 500).json({ 
      error: 'Error fetching ad details',
      message: error.message
    });
  }
};

/**
 * Get success patterns from analyzed ads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSuccessPatterns = async (req, res) => {
  try {
    const patterns = await AdAnalysisEngine.getSuccessPatterns();
    
    res.json({
      success: true,
      data: patterns,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error fetching success patterns', error);
    res.status(500).json({ 
      error: 'Error fetching success patterns',
      message: error.message
    });
  }
};
