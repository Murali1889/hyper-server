const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.headers['authorization'].split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Verify the access token by making a test request
    try {
      await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${user.accessToken}`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Access token is invalid or expired, refresh it
        const refreshTokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          refresh_token: user.refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        });

        const { access_token, expires_in } = refreshTokenResponse.data;
        user.accessToken = access_token;
        await user.save();

        const newToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        req.headers['authorization'] = newToken;
      } else {
        throw error;
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ success: false, message: 'Failed to authenticate token' });
  }
};

module.exports = authMiddleware;