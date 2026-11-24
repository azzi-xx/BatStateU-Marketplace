const express = require('express');
const campusModel = require('../models/campus.model');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ data: campusModel.all() });
});

module.exports = router;
