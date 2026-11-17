const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const listingController = require('../controllers/listing.controller');

const router = express.Router();

// Public browsing
router.get('/', listingController.browse);
router.get('/:id', listingController.detail);

// Requires a session; the service layer enforces ownership rules.
router.post('/', requireAuth, upload.single('image'), asyncHandler(listingController.create));
router.patch('/:id', requireAuth, upload.single('image'), asyncHandler(listingController.update));
router.delete('/:id', requireAuth, asyncHandler(listingController.remove));

module.exports = router;
