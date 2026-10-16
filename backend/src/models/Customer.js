'use strict';

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    businessName:     { type: String, trim: true, default: '' },
    phone:            { type: String, trim: true, default: '' },
    whatsapp:         { type: String, trim: true, default: '' },
    email:            { type: String, trim: true, default: '' },
    address:          { type: String, trim: true, default: '' },
    notes:            { type: String, default: '' },
    isProfileAccount: { type: Boolean, default: false },
    advanceBalance:   { type: Number, default: 0 },
    advanceHistory:   { type: Array, default: [] },
    // Carry-forward from localStorage schema
    localId:          { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Customer', CustomerSchema);
