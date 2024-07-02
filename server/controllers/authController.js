const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authController = {
  googleAuth: async (req, res) => {
    const { code } = req.query;

    try {
      const { data } = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const { id_token, access_token, refresh_token, expires_in } = data;
      const ticket = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${id_token}`);
      const { sub, name, email } = ticket.data;

      let user = await User.findOne({ googleId: sub });
      if (!user) {
        user = new User({ googleId: sub, name, email, accessToken: access_token, refreshToken: refresh_token, createdAt: new Date() });
        await user.save();
      } else {
        user.accessToken = access_token;
        user.refreshToken = refresh_token;
        await user.save();
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      const expirationTime = Date.now() + expires_in * 1000;

      res.json({ success: true, accessToken: token, expirationTime });
    } catch (error) {
      console.error('Error during Google authentication:', error);
      res.status(500).json({ success: false, message: 'Error during Google authentication', error: error.message });
    }
  },

  checkAuthorization: async (req, res) => {
    const { token } = req.query;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }

      // Check if the token is valid with Google
      const { data } = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${user.accessToken}`);
      if (data) {
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
        const expirationTime = Date.now() + expires_in * 1000;
        return res.json({ success: true, accessToken: newToken, expirationTime });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error checking authorization:', error);
      res.status(500).json({ success: false, message: 'Error checking authorization', error: error.message });
    }
  },
};

module.exports = authController;