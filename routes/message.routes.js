const express = require('express');
const { requireAuth } = require('../middleware/auth');
const messageController = require('../controllers/message.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', messageController.threads);
router.get('/unread', messageController.unread);
router.get('/thread/:listingId', messageController.thread);
router.post('/', messageController.send);

module.exports = router;
