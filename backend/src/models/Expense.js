'use strict';

const mongoose = require('mongoose');

const PaymentHistorySchema = new mongoose.Schema(
  {
    id:        { type: String, required: true },
    reference: { type: String, default: '' },
    amount:    { type: Number, required: true, min: 0 },
    method:    { type: String, enum: ['Cash', 'Online', 'Bank'], default: 'Cash' },
    paidAt:    { type: String, required: true },  // ISO date string
    notes:     { type: String, default: '' },
    paidBy:    { type: String, default: '' },
    receipt:   {
      id:   { type: String },
      name: { type: String },
      type: { type: String },
      size: { type: Number },
    },
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    // Carry-forward from localStorage schema
    localId:         { type: String, index: true, sparse: true },
    expenseNumber:   { type: String, default: '' },
    title:           { type: String, required: true, trim: true },
    category:        { type: String, required: true, trim: true, default: 'General' },
    vendor:          { type: String, default: '' },
    vendorId:        { type: String, default: '' },
    amount:          { type: Number, required: true, min: 0 },
    paidAmount:      { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    paymentStatus:   {
      type: String,
      enum: ['Paid', 'Partial', 'Unpaid', 'Credit'],
      default: 'Paid',
    },
    paymentMethod:   {
      type: String,
      enum: ['Cash', 'Online', 'Bank', 'Credit'],
      default: 'Cash',
    },
    paymentHistory:  { type: [PaymentHistorySchema], default: [] },
    paidBy:          { type: String, default: '' },
    paidAt:          { type: String, default: '' },
    linkedPurchaseId: { type: String, default: '' },
    stockQuantity:   { type: Number },
    date:            { type: String, required: true },  // YYYY-MM-DD
    notes:           { type: String, default: '' },
  },
  {
    timestamps: true,  // adds createdAt, updatedAt
    versionKey: false,
  }
);

// Indexes for common query patterns
ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
