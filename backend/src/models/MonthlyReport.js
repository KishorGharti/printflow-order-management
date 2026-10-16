'use strict';

const mongoose = require('mongoose');

const MonthlyReportSchema = new mongoose.Schema(
  {
    month:              { type: String, required: true, index: true }, // Format 'YYYY-MM'
    year:               { type: String, required: true, index: true, default: function() { return (this.month || '').slice(0, 4); } },
    title:              { type: String, required: true },
    periodStart:        { type: String, required: true },
    periodEnd:          { type: String, required: true },
    totalRevenue:       { type: Number, default: 0 },
    totalExpenses:      { type: Number, default: 0 },
    netProfit:          { type: Number, default: 0 },
    orderCount:         { type: Number, default: 0 },
    cloudinaryPdfUrl:   { type: String, default: '' },
    cloudinaryPublicId: { type: String, default: '' },
    isArchivedLocally:  { type: Boolean, default: false },
    archivedLocallyAt:  { type: Date, default: null },
    isDeletedFromCloud: { type: Boolean, default: false },
    deletedFromCloudAt: { type: Date, default: null },
    cloudCleanupStatus: { type: String, enum: ['ACTIVE', 'ARCHIVED_LOCAL', 'PURGED_FROM_CLOUD'], default: 'ACTIVE' },
    generatedAt:        { type: Date, default: Date.now },
    summaryData:        { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('MonthlyReport', MonthlyReportSchema);
