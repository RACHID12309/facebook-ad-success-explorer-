// src/models/successfulAd.js
const mongoose = require('mongoose');

const successfulAdSchema = new mongoose.Schema({
  adId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  successScore: {
    type: Number,
    required: true
  },
  componentScores: {
    durationScore: Number,
    spendScore: Number,
    impressionsScore: Number,
    engagementScore: Number
  },
  adData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
successfulAdSchema.index({ successScore: -1 });
successfulAdSchema.index({ updatedAt: -1 });
successfulAdSchema.index({ 'adData.page_name': 'text', 'adData.ad_creative_bodies': 'text' });

const SuccessfulAdModel = mongoose.model('SuccessfulAd', successfulAdSchema);

module.exports = SuccessfulAdModel;