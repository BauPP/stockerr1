'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const { errorHandler } = require('../../shared/middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  return res.status(200).json({
    mensaje: 'API Gateway funcionando',
  });
});

app.use('/api/auth', authRoutes);

app.use(errorHandler);

module.exports = app;