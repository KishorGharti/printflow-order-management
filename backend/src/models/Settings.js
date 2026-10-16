'use strict';

const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    key:                          { type: String, default: 'global_settings', unique: true, index: true },
    shopName:                     { type: String, default: 'PrintGhar' },
    shopPhone:                    { type: String, default: '9800000000' },
    shopEmail:                    { type: String, default: 'printghar@gmail.com' },
    shopAddress:                  { type: String, default: 'Ghorahi, Dang' },
    shopLogo:                     { type: String, default: '' },
    openingBalance:               { type: Number, default: 0 },
    currency:                     { type: String, default: 'Rs.' },
    dateMode:                     { type: String, enum: ['AD', 'BS'], default: 'AD' },
    jobPrefix:                    { type: String, default: 'JOB-' },
    jobStartNumber:               { type: Number, default: 1042 },
    invoicePrefix:                { type: String, default: '' },
    invoiceStartNumber:           { type: Number, default: 1 },
    brandPrimary:                 { type: String, default: '#4f46e5' },
    appearance:                   { type: String, enum: ['light', 'dark'], default: 'light' },
    whatsappNotificationsEnabled: { type: Boolean, default: true },
    whatsappSenderNumber:         { type: String, default: '' },
    whatsappTemplate:             { type: String, default: '' },
    balanceSheetHeaderColor:      { type: String, default: '#0026ff' },
    balanceSheetHeaderTextColor:  { type: String, default: '#ffffff' },
    balanceSheetFooterColor:      { type: String, default: '#0026ff' },
    balanceSheetFooterTextColor:  { type: String, default: '#ffffff' },
    balanceSheetAlternateColor:   { type: String, default: '#f1f5f9' },
    balanceSheetAlternateTint:    { type: Number, default: 100 },
    allTransactionsHeaderColor:   { type: String, default: '#1e293b' },
    allTransactionsHeaderTextColor:{ type: String, default: '#ffffff' },
    allTransactionsFooterColor:   { type: String, default: '#1e293b' },
    allTransactionsFooterTextColor:{ type: String, default: '#ffffff' },
    allTransactionsAlternateColor:{ type: String, default: '#f8fafc' },
    allTransactionsAlternateTint: { type: Number, default: 100 },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

module.exports = mongoose.model('Settings', SettingsSchema);
