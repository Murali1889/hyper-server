const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  accessToken: String,
  refreshToken: String,
});
module.exports = mongoose.model('User', UserSchema);