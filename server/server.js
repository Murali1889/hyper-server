const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type,Authorization'
}));

app.use(bodyParser.json());

connectDB();

const authRoutes = require('./routes/authRoutes');
const googleSheetsRoutes = require('./routes/googleSheetsRoutes');

app.use('/auth', authRoutes);
app.use('/sheets', googleSheetsRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});