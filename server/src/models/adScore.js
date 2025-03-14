// src/models/adScore.js
const mongoose = require('mongoose');

const adScoreSchema = new mongoose.Schema({
  adId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  totalScore: {
    type: Number,
    required: true
  },
  componentScores: {
    durationScore: Number,
    spendScore: Number,
    impressionsScore: Number,
    engagementScore: Number
  },
  rawMetrics: {
    durationDays: Number,
    spendAmount: Number,
    impressions: Number,
    estimatedEngagement: Number,
    dailySpend: Number,
    dailyImpressions: Number
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
adScoreSchema.index({ totalScore: -1 });
adScoreSchema.index({ updatedAt: -1 });

const AdScoreModel = mongoose.model('AdScore', adScoreSchema);

module.exports = AdScoreModel;