const AppError = require('../utils/AppError');
const listingService = require('../services/listing.service');

function parseId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound('That listing does not exist.');
  return id;
}

function browse(req, res) {
  res.json(listingService.browse(req.query, req.user));
}

function detail(req, res) {
  res.json({ data: listingService.getById(parseId(req.params.id), req.user) });
}

function create(req, res) {
  const listing = listingService.create(req.body, req.user, req.file);
  res.status(201).json({ data: listing });
}

function update(req, res) {
  const listing = listingService.update(parseId(req.params.id), req.body, req.user, req.file);
  res.json({ data: listing });
}

function remove(req, res) {
  const listing = listingService.remove(parseId(req.params.id), req.user);
  res.json({ data: listing });
}

module.exports = { browse, detail, create, update, remove };
