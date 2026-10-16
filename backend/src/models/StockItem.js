'use strict';

const mongoose = require('mongoose');

const StockItemSchema = new mongoose.Schema(
  {
    name:              { type: String, required: true, trim: true },
    category:          { type: String, default: 'General', trim: true },
    quantity:          { type: Number, default: 0, min: 0 },
    unit:              { type: String, default: 'pcs' },
    parentId:          { type: String, default: null },
    hasSubItems:       { type: Boolean, default: false },
    subItems:          { type: Array, default: [] },
    lowStockThreshold: { type: Number, default: 5 },
    minQuantity:       { type: Number, default: 0 },
    cost:              { type: Number, default: 0 },
    purchaseAmount:    { type: Number, default: 0 },
    vendor:            { type: String, default: '' },
    vendorId:          { type: String, default: '' },
    isArchived:        { type: Boolean, default: false },
    archivedAt:        { type: String, default: null },
    sourceExpenseId:   { type: String, default: '' },
    purchaseNumber:    { type: String, default: '' },
    notes:             { type: String, default: '' },
    localId:           { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('StockItem', StockItemSchema);
