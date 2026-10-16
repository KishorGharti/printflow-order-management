'use strict';

const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    productId:       { type: String, default: '' },
    productName:     { type: String, default: 'Product' },
    unit:            { type: String, default: 'pcs' },
    quantity:        { type: Number, default: 0, min: 0 },
    unitPrice:       { type: Number, default: 0, min: 0 },
    defaultPrice:    { type: Number, default: 0 },
    customerPrice:   { type: Number },
    lineTotal:       { type: Number, default: 0, min: 0 },
    itemDescription: { type: String, default: '' },
    width:           { type: Number },
    height:          { type: Number },
    variant:         { type: String },
  },
  { _id: false, strict: false }
);

const HistorySchema = new mongoose.Schema(
  {
    status:    { type: String },
    note:      { type: String },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false, strict: false }
);

const MediaSchema = new mongoose.Schema(
  {
    id:                 { type: String, required: true },
    name:               { type: String, required: true },
    type:               { type: String, default: '' },
    size:               { type: Number, default: 0 },
    extension:          { type: String, default: '' },
    category:           { type: String, default: 'Client Reference' }, // 'Ready to Go' | 'Client Reference'
    cloudinaryUrl:      { type: String, default: '' },
    cloudinaryPublicId: { type: String, default: '' },
    resourceType:       { type: String, default: 'image' },
    uploadedBy:         { type: String, default: '' },
    uploadedAt:         { type: String, default: () => new Date().toISOString() },
    isDeletedFromCloud: { type: Boolean, default: false },
    deletedFromCloudAt: { type: String },
  },
  { _id: false, strict: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber:      { type: String, required: true, unique: true, index: true },
    customerId:       { type: String, required: true, index: true },
    customerName:     { type: String, default: '' },
    customerPhone:    { type: String, default: '' },
    customerEmail:    { type: String, default: '' },
    customerWhatsapp: { type: String, default: '' },
    status:           {
      type: String,
      enum: ['New', 'In Design', 'Printing', 'Finishing', 'Done', 'Ready', 'Payment',
             'Pickup', 'Delivery', 'Cancelled', 'Mistake'],
      default: 'New',
    },
    items:            { type: [OrderItemSchema], default: [] },
    totalAmount:      { type: Number, default: 0, min: 0 },
    orderDate:        { type: String, default: () => new Date().toISOString().slice(0, 10) },   // AD date string YYYY-MM-DD
    dueDate:          { type: String, default: () => new Date().toISOString().slice(0, 10) },
    notes:            { type: String, default: '' },
    paymentMethod:    { type: String },
    paymentStatus:    { type: String, enum: ['Unpaid', 'Partial', 'Paid', 'Credit'], default: 'Unpaid' },
    media:            { type: [MediaSchema], default: [] },
    history:          { type: [HistorySchema], default: [] },
    // Carry-forward from localStorage schema
    localId:          { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Order', OrderSchema);
