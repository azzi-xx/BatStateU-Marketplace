const AppError = require('../utils/AppError');
const mapService = require('../services/map.service');

function list(_req, res) {
  res.json({ data: mapService.listCampuses() });
}

async function map(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) throw AppError.notFound('That campus does not exist.');

  res.json({ data: await mapService.getCampusMap(id) });
}

module.exports = { list, map };
