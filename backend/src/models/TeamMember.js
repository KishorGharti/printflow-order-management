'use strict';

const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    jobTitle: { type: String, required: true, trim: true },
    phone:    { type: String, default: '', trim: true },
    salary:   { type: Number, default: 0, min: 0 },
    borrowed: { type: Number, default: 0, min: 0 },
    pin:      { type: String, default: '123456' },
    records:  { type: Array, default: [] },
    localId:  { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('TeamMember', TeamMemberSchema);
