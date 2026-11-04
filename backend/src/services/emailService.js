const nodemailer = require('nodemailer');

const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 465,
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * Sends a 6-digit password reset OTP email
 */
async function sendPasswordResetOtp(toEmail, otp, recipientName = 'User') {
  const mailOptions = {
    from: `"PrintFlow by Algora" <${SMTP_USER}>`,
    to: toEmail,
    subject: `Your Password Reset Code: ${otp}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 8px 16px; background: #0f172a; color: #ffffff; border-radius: 9999px; font-weight: 800; font-size: 13px; letter-spacing: -0.02em;">
            Cogie PrintFlow
          </div>
        </div>
        <h2 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 12px 0; color: #0f172a; letter-spacing: -0.02em;">
          Reset Your Password
        </h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; text-align: center; margin: 0 0 24px 0;">
          Hello <strong>${recipientName}</strong>, we received a request to reset your password for your PrintFlow client account. Use the verification code below to proceed:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; padding: 14px 28px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0f172a; font-family: monospace;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 12px; line-height: 1.6; color: #64748b; text-align: center; margin: 0 0 24px 0;">
          ⏳ This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
        </p>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
          © 2026 Algora Platform. All rights reserved. • Contact: ${SMTP_USER}
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Sends a 6-digit registration / new user activation OTP email
 */
async function sendRegistrationOtp(toEmail, otp, recipientName = 'User', companyName = 'Print Shop') {
  const mailOptions = {
    from: `"PrintFlow by Algora" <${SMTP_USER}>`,
    to: toEmail,
    subject: `Welcome to PrintFlow! Your Verification Code: ${otp}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 8px 16px; background: #0f172a; color: #ffffff; border-radius: 9999px; font-weight: 800; font-size: 13px; letter-spacing: -0.02em;">
            Cogie PrintFlow
          </div>
        </div>
        <h2 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 12px 0; color: #0f172a; letter-spacing: -0.02em;">
          Verify Your Email
        </h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; text-align: center; margin: 0 0 24px 0;">
          Welcome to PrintFlow, <strong>${recipientName}</strong>! Your account for <strong>${companyName}</strong> has been created. Please enter this verification code to activate your client portal:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; padding: 14px 28px; background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #166534; font-family: monospace;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 12px; line-height: 1.6; color: #64748b; text-align: center; margin: 0 0 24px 0;">
          ⏳ This verification code expires in <strong>15 minutes</strong>.
        </p>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
          © 2026 Algora Platform. All rights reserved. • Contact: ${SMTP_USER}
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Sends the 6-digit developer console sign-in code
 */
async function sendDeveloperMfaCode(toEmail, otp) {
  return transporter.sendMail({
    from: `"PrintFlow by Algora" <${SMTP_USER}>`,
    to: toEmail,
    subject: 'Your developer console sign-in code',
    text: `Your developer console sign-in code is ${otp}. It is valid for 10 minutes. If you did not try to sign in, change DEVELOPER_PASSWORD now.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; color: #0f172a;">
        <h2 style="font-size: 20px; font-weight: 800; text-align: center; margin: 0 0 12px 0;">Developer console sign-in</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; text-align: center; margin: 0 0 24px 0;">Use this code to finish signing in:</p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; padding: 14px 28px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 6px; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 12px; line-height: 1.6; color: #64748b; text-align: center; margin: 0;">This code is valid for <strong>10 minutes</strong>. If you did not try to sign in, change DEVELOPER_PASSWORD now.</p>
      </div>
    `,
  });
}

module.exports = {
  transporter,
  sendPasswordResetOtp,
  sendRegistrationOtp,
  sendDeveloperMfaCode,
};
