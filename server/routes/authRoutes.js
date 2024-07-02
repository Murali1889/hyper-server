const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/google', (req, res) => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}/auth/google/callback&response_type=code&scope=openid%20email%20profile`;
  res.redirect(url);
});

router.get('/google/callback', authController.googleAuth);
router.get('/check-authorization', authController.checkAuthorization);

module.exports = router;