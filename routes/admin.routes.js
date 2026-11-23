const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

// Two gates: must be logged in AND must be an administrator.
router.use(requireAuth, requireAdmin);

router.get('/overview', adminController.overview);
router.get('/charts', adminController.charts);

router.get('/users', adminController.users);
router.patch('/users/:id', adminController.setUserStatus);

router.get('/listings', adminController.listings);
router.delete('/listings/:id', adminController.removeListing);
router.post('/listings/:id/restore', adminController.restoreListing);

router.get('/orders', adminController.orders);

router.get('/inspect', adminController.inspect);
router.get('/queries', adminController.queries);
router.get('/pipeline/:id', adminController.pipeline);

module.exports = router;
