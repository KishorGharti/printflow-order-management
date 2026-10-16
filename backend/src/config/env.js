const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();

const required = ['DATABASE_URL', 'API_SECRET_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Config] Missing required environment variable: ${key}`);
    console.error('[Config] Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

const env = {
  PORT:                     process.env.PORT || '3001',
  NODE_ENV:                 process.env.NODE_ENV || 'development',
  DATABASE_URL:             process.env.DATABASE_URL,
  API_SECRET_KEY:           process.env.API_SECRET_KEY,
  CLOUDINARY_CLOUD_NAME:    process.env.CLOUDINARY_CLOUD_NAME || 'nwk5h0et',
  CLOUDINARY_API_KEY:       process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET:    process.env.CLOUDINARY_API_SECRET || '',
  WHATSAPP_ACCESS_TOKEN:    process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_API_VERSION:     process.env.WHATSAPP_API_VERSION || 'v19.0',
  ALLOWED_ORIGINS:          process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
  SMTP_HOST:                process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT:                parseInt(process.env.SMTP_PORT, 10) || 465,
  SMTP_SECURE:              String(process.env.SMTP_SECURE || 'true') === 'true',
  SMTP_USER:                process.env.SMTP_USER || '',
  SMTP_PASS:                process.env.SMTP_PASS || '',
};

module.exports = { env };
