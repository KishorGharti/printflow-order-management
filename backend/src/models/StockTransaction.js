'use strict';

const mongoose = require('mongoose');

const StockTransactionSchema = new mongoose.Schema(
  {
    inventoryItemId:   { type: String, required: true, index: true },
    inventoryItemName: { type: String, default: '' },
    quantity:          { type: Number, required: true },
    signedQuantity:    { type: Number, required: true },
    unit:              { type: String, default: 'pcs' },
    transactionType:   {
      type: String,
      enum: ['RESERVE', 'RELEASE', 'CONSUME', 'RESTORE', 'PURCHASE', 'ADJUST', 'RETURN', 'MANUAL'],
      default: 'ADJUST'
    },
    orderId:           { type: String, default: '', index: true },
    orderNumber:       { type: String, default: '' },
    masterProductId:   { type: String, default: '' },
    masterProductName: { type: String, default: '' },
    orderItemId:       { type: String, default: '' },
    timestamp:         { type: String, default: () => new Date().toISOString() },
    user:              { type: String, default: 'System' },
    automatic:         { type: Boolean, default: true },
    reason:            { type: String, default: '' },
    localId:           { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('StockTransaction', StockTransactionSchema);
