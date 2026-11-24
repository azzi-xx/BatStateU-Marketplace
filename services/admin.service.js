/**
 * Admin rules and read models.
 *
 * Everything that counts rows is done in `models/stats.model.js` with SQL.
 * This layer converts centavos to pesos, picks date ranges, validates the few
 * inputs an admin can send, and enforces "you cannot suspend yourself".
 */
const AppError = require('../utils/AppError');
const validate = require('../utils/validate');
const statsModel = require('../models/stats.model');
const userModel = require('../models/user.model');
const listingModel = require('../models/listing.model');
const orderModel = require('../models/order.model');
const inspectModel = require('../models/inspect.model');
const orderService = require('./order.service');
const listingService = require('./listing.service');
const queryLog = require('../utils/queryLog');

const USER_STATUSES = ['active', 'suspended'];

function organizationFor(email) {
  const domain = String(email || '').toLowerCase().split('@')[1] || '';
  return domain === 'g.batstate-u.edu.ph' ? 'internal' : 'external';
}
const USER_ROLES = ['student', 'admin'];
const LISTING_STATUSES = ['available', 'reserved', 'sold', 'removed'];
const ORDER_STATUSES = ['pending', 'completed', 'cancelled'];
const RANGES = [7, 30, 90];

function peso(centavos) {
  return Math.round(centavos || 0) / 100;
}

function assertAdmin(viewer) {
  if (!viewer || viewer.role !== 'admin') {
    throw AppError.forbidden('Admin access only.');
  }
}

function clean(value, max = 80) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function pick(value, allowed, fallback = 'all') {
  return allowed.includes(value) ? value : fallback;
}

function toUserApi(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    program: row.program,
    yearLevel: row.yearLevel,
    campus: row.campusId ? { id: row.campusId, name: row.campusName, slug: row.campusSlug } : null,
    status: row.status,
    organization: organizationFor(row.email),
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    listingCount: row.listingCount ?? 0,
    purchaseCount: row.purchaseCount ?? 0,
    salesCount: row.salesCount ?? 0,
  };
}

/** One payload for the dashboard's KPI cards, recent table and top sellers. */
function overview() {
  const stats = statsModel.overview();

  return {
    kpis: {
      revenue: peso(stats.orders.revenueCentavos),
      revenue30d: peso(stats.orders.revenue30dCentavos),
      revenue7d: peso(stats.orders.revenue7dCentavos),
      orders: stats.orders,
      listings: stats.listings,
      users: stats.users,
      messages: stats.messages,
    },
    recentOrders: orderModel.listAll({ limit: 8 }).map((row) => orderService.toApi(row)),
    topSellers: statsModel.topSellers(5).map((row) => ({
      sellerId: row.sellerId,
      name: row.name,
      sales: row.sales,
      revenue: peso(row.revenueCentavos),
    })),
    categories: statsModel.listingsByCategory(),
    statuses: statsModel.listingsByStatus(),
  };
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a complete, gap-free daily series. SQL returns only days that have
 * rows; the chart needs every day in the range, so missing days are filled
 * with zero here (presentation prep, not aggregation).
 */
function charts(rangeInput) {
  const range = RANGES.includes(Number(rangeInput)) ? Number(rangeInput) : 30;

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (range - 1));
  const since = dateKey(start);

  const users = new Map(statsModel.newUsersByDay(since).map((row) => [row.day, row.count]));
  const listings = new Map(statsModel.newListingsByDay(since).map((row) => [row.day, row.count]));
  const orders = new Map(
    statsModel.completedOrdersByDay(since).map((row) => [row.day, { count: row.count, revenue: row.revenueCentavos }])
  );

  const labels = [];
  const series = { users: [], listings: [], orders: [], revenue: [] };

  for (let offset = 0; offset < range; offset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);
    const key = dateKey(day);

    labels.push(key.slice(5)); // MM-DD
    series.users.push(users.get(key) || 0);
    series.listings.push(listings.get(key) || 0);
    series.orders.push(orders.get(key)?.count || 0);
    series.revenue.push(peso(orders.get(key)?.revenue || 0));
  }

  return { range, labels, ...series };
}

function users(query = {}) {
  const data = userModel.list({
    q: clean(query.q, 80) || undefined,
    role: pick(query.role, USER_ROLES, 'all'),
    status: pick(query.status, USER_STATUSES, 'all'),
    limit: 200,
  });

  return { data: data.map(toUserApi) };
}

function setUserStatus(id, input, viewer) {
  assertAdmin(viewer);

  const target = userModel.findPublicById(id);
  if (!target) throw AppError.notFound('That user does not exist.');

  const status = validate.oneOf(input.status, USER_STATUSES, 'Status');

  if (target.id === viewer.id) {
    throw AppError.unprocessable('You cannot change the status of your own account.');
  }
  if (target.role === 'admin' && status === 'suspended') {
    throw AppError.forbidden('Administrator accounts cannot be suspended.');
  }

  const updated = userModel.setStatus(id, status);
  return { id: updated.id, status: updated.status };
}

function listings(query = {}) {
  const data = listingModel.adminList({
    q: clean(query.q, 80) || undefined,
    status: pick(query.status, LISTING_STATUSES, 'all'),
    limit: 200,
  });

  return { data: data.map(listingService.toApi) };
}

function removeListing(id, viewer) {
  assertAdmin(viewer);
  return listingService.remove(id, viewer);
}

function restoreListing(id, viewer) {
  assertAdmin(viewer);

  const existing = listingModel.findById(id);
  if (!existing) throw AppError.notFound('That listing does not exist.');
  if (existing.status !== 'removed') {
    throw AppError.conflict('Only removed listings can be restored.');
  }

  return listingService.toApi(listingModel.setStatus(id, 'available'));
}

function orders(query = {}) {
  const data = orderModel.listAll({
    status: pick(query.status, ORDER_STATUSES, 'all'),
    limit: 300,
  });

  return { data: data.map((row) => orderService.toApi(row)) };
}

/** Table shapes, row counts, and recent rows for the data lab. */
function inspect(viewer) {
  assertAdmin(viewer);

  const counts = inspectModel.tableCounts();
  const columns = inspectModel.tableColumns();

  const tables = columns.map(({ table, columns: cols }) => ({
    name: table,
    rows: counts[table] || 0,
    columns: cols,
  }));

  return {
    tables,
    recent: {
      users: userModel.list({ limit: 6 }).map(toUserApi),
      listings: listingModel.adminList({ limit: 6 }).map(listingService.toApi),
      orders: orderModel.listAll({ limit: 6 }).map((row) => orderService.toApi(row)),
      messages: inspectModel.recentMessages(6),
    },
  };
}

/** Recent SQL activity captured by `config/db.js`. */
function queries(limit, viewer) {
  assertAdmin(viewer);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 60, 200));
  return { data: queryLog.list(safeLimit) };
}

/** Raw row, mapped API object, and the SQL that produced them for one listing. */
function pipeline(id, viewer) {
  assertAdmin(viewer);

  const raw = listingModel.findById(id);
  if (!raw) throw AppError.notFound('That listing does not exist.');

  return {
    raw,
    api: listingService.toApi(raw),
    activity: inspectModel.listingActivity(id),
    queries: queryLog.forCurrentRequest(20),
  };
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
