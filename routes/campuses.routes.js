const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const campusController = require('../controllers/campus.controller');

const router = express.Router();

router.get('/', campusController.list);
router.get('/:id/map', asyncHandler(campusController.map));

module.exports = router;
