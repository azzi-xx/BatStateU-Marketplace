const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orderController = require('../controllers/order.controller');

const router = express.Router();

// Buying and selling requires a session; ownership rules live in the service.
router.use(requireAuth);

router.get('/', orderController.mine);
router.post('/', orderController.request);
router.patch('/:id', orderController.update);

module.exports = router;
