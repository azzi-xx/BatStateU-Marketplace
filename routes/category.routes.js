const express = require('express');
const categoryModel = require('../models/category.model');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ data: categoryModel.all() });
});

module.exports = router;
