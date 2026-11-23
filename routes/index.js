/**
 * Application-tier router: mounts every REST resource under /api.
 * Presentation (public/) only ever talks to these endpoints.
 */
const express = require('express');
const { apiNotFound } = require('../middleware/error');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'batstateu-marketplace', time: new Date().toISOString() });
});

router.use('/auth', require('./auth.routes'));
router.use('/listings', require('./listing.routes'));
router.use('/categories', require('./category.routes'));
router.use('/orders', require('./order.routes'));
router.use('/messages', require('./message.routes'));
router.use('/admin', require('./admin.routes'));

router.use(apiNotFound);

module.exports = router;
