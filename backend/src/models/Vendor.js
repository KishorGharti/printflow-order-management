'use strict';

const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    phone:   { type: String, default: '', trim: true },
    email:   { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    notes:   { type: String, default: '' },
    localId: { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Vendor', VendorSchema);
