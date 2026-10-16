'use strict';

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name:                 { type: String, required: true, trim: true },
    category:             { type: String, default: 'General', trim: true },
    defaultPrice:         { type: Number, required: true, min: 0 },
    unit:                 { type: String, required: true, default: 'pcs' },
    description:          { type: String, default: '' },
    isActive:             { type: Boolean, default: true },
    materials:            { type: Array, default: [] },
    stockMaterialsEnabled:{ type: Boolean, default: false },
    deductAutoStockAt:    { type: String, default: 'Finishing' },
    variantPrices:        { type: Object, default: {} },
    subItems:             { type: Array, default: [] },
    hasSubItems:          { type: Boolean, default: false },
    lowStockThreshold:    { type: Number, default: 5 },
    // Carry-forward from localStorage schema
    localId:              { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Product', ProductSchema);
