const AppError = require('../utils/AppError');
const messageService = require('../services/message.service');

function parseId(value, label) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound(`${label} not found.`);
  return id;
}

function send(req, res) {
  res.status(201).json({ data: messageService.send(req.user, req.body) });
}

function threads(req, res) {
  res.json(messageService.threads(req.user));
}

function thread(req, res) {
  const listingId = parseId(req.params.listingId, 'Listing');
  res.json(messageService.thread(req.user, listingId, req.query.partnerId));
}

function unread(req, res) {
  res.json(messageService.unread(req.user));
}

module.exports = { send, threads, thread, unread };
