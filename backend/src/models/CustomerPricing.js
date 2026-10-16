'use strict';

const mongoose = require('mongoose');

const CustomerPricingSchema = new mongoose.Schema(
  {
    customerId:  { type: String, required: true, index: true },
    productId:   { type: String, required: true, index: true },
    variant:     { type: String, default: '' },
    customPrice: { type: Number, required: true, min: 0 },
    localId:     { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

// Compound index to ensure uniqueness per customer, product, and variant
CustomerPricingSchema.index({ customerId: 1, productId: 1, variant: 1 }, { unique: true });

module.exports = mongoose.model('CustomerPricing', CustomerPricingSchema);
