// src/routes/ads.js
const express = require('express');
const router = express.Router();
const adController = require('../controllers/adController');
const { rateLimiterMiddleware } = require('../utils/rateLimiter');

// Apply rate limiter to ad-related routes
router.use(rateLimiterMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,     // 20 requests per minute
  message: 'Too many ad search requests, please try again later.'
}));

/**
 * @route   GET /api/ads/search
 * @desc    Search for successful ads
 * @access  Public
 */
router.get('/search', adController.searchSuccessfulAds);

/**
 * @route   GET /api/ads/:adId
 * @desc    Get details of a specific ad
 * @access  Public
 */
router.get('/:adId', adController.getAdDetails);

/**
 * @route   GET /api/ads/patterns/success
 * @desc    Get patterns from successful ads
 * @access  Public
 */
router.get('/patterns/success', adController.getSuccessPatterns);

module.exports = router;