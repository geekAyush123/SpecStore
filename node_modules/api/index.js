const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

const PredictionSchema = new mongoose.Schema({
  filename: String,
  specs: Object,
  createdAt: { type: Date, default: Date.now }
});
const Prediction = mongoose.model('Prediction', PredictionSchema);

// --- File Upload Setup ---
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

// --- Routes ---
app.get('/api', (req, res) => {
  res.json({ message: 'Backend API is running' });
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  try {
    const mlServiceUrl = `${process.env.ML_SERVICE_URL}/process-image/`;

    // Forward the image to the Python ML service
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname });

    const response = await axios.post(mlServiceUrl, form, {
      headers: { ...form.getHeaders() }
    });

    // Save the result to MongoDB
    const newPrediction = new Prediction({
      filename: req.file.originalname,
      specs: response.data,
    });
    await newPrediction.save();

    // Send the prediction back to the frontend
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error processing image:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to process image.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
