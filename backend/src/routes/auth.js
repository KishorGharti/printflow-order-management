'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateUser } = require('../middleware/rbac');

router.post('/login', authController.login);
router.post('/client-login', authController.clientLogin);
router.post('/client-forgot-password', authController.clientForgotPassword);
router.post('/client-reset-password', authController.clientResetPassword);
router.post('/client-register', authController.clientRegister);
router.post('/client-verify-registration', authController.clientVerifyRegistration);
router.post('/client-token-sync', authController.clientTokenSync);
router.post('/change-password', authenticateUser, authController.changePassword);
router.get('/me', authenticateUser, authController.me);

module.exports = router;
