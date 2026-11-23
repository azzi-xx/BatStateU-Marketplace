const AppError = require('../utils/AppError');
const orderService = require('../services/order.service');

function parseId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound('That order does not exist.');
  return id;
}

function request(req, res) {
  res.status(201).json({ data: orderService.request(req.body, req.user) });
}

function mine(req, res) {
  res.json(orderService.mine(req.user, req.query.view || 'all'));
}

function update(req, res) {
  res.json({ data: orderService.update(parseId(req.params.id), req.user, req.body) });
}

module.exports = { request, mine, update };
