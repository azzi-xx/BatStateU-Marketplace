const AppError = require('../utils/AppError');
const adminService = require('../services/admin.service');

function parseId(value, label) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound(`${label} not found.`);
  return id;
}

function overview(_req, res) {
  res.json({ data: adminService.overview() });
}

function charts(req, res) {
  res.json({ data: adminService.charts(req.query.range) });
}

function users(req, res) {
  res.json(adminService.users(req.query));
}

function setUserStatus(req, res) {
  res.json({ data: adminService.setUserStatus(parseId(req.params.id, 'User'), req.body, req.user) });
}

function listings(req, res) {
  res.json(adminService.listings(req.query));
}

function removeListing(req, res) {
  res.json({ data: adminService.removeListing(parseId(req.params.id, 'Listing'), req.user) });
}

function restoreListing(req, res) {
  res.json({ data: adminService.restoreListing(parseId(req.params.id, 'Listing'), req.user) });
}

function orders(req, res) {
  res.json(adminService.orders(req.query));
}

function inspect(req, res) {
  res.json({ data: adminService.inspect(req.user) });
}

function queries(req, res) {
  res.json(adminService.queries(req.query.limit, req.user));
}

function pipeline(req, res) {
  res.json({ data: adminService.pipeline(parseId(req.params.id, 'Listing'), req.user) });
}

module.exports = {
  overview,
  charts,
  users,
  setUserStatus,
  listings,
  removeListing,
  restoreListing,
  orders,
  inspect,
  queries,
  pipeline,
};
