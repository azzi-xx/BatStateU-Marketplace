/**
 * Business rules for buying and selling.
 *
 * Flow:  available  --request-->  reserved  --confirm-->  sold
 *                                     |
 *                                     +--cancel-->  available
 */
const AppError = require('../utils/AppError');
const validate = require('../utils/validate');
const orderModel = require('../models/order.model');
const listingModel = require('../models/listing.model');
const mapService = require('./map.service');

const ACTIONS = ['complete', 'cancel'];
const MEETUP_RESPONSES = ['confirm', 'reject'];
const VIEWS = ['buying', 'selling', 'all'];

function coordinate(value, label, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw AppError.unprocessable(`${label} must be a number.`);
  if (n < min || n > max) throw AppError.unprocessable(`${label} is outside the map.`);
  return n;
}

function toApi(row, viewer = null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    note: row.note,
    amount: row.amountCentavos / 100,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    listing: {
      id: row.listingId,
      title: row.listingTitle,
      imagePath: row.listingImage,
      status: row.listingStatus,
      category: { name: row.categoryName, slug: row.categorySlug },
      campus: row.listingCampusId
        ? {
            id: row.listingCampusId,
            name: row.listingCampusName,
            slug: row.listingCampusSlug,
            latitude: row.listingCampusLatitude,
            longitude: row.listingCampusLongitude,
          }
        : null,
    },
    buyer: { id: row.buyerId, name: row.buyerName },
    seller: { id: row.sellerId, name: row.sellerName },
    meetup: {
      status: row.meetupStatus,
      label: row.meetupLabel,
      latitude: row.meetupLatitude,
      longitude: row.meetupLongitude,
      revision: row.meetupRevision,
      proposedAt: row.meetupProposedAt,
      confirmedAt: row.meetupConfirmedAt,
    },
    isBuyer: viewer ? viewer.id === row.buyerId : false,
    isSeller: viewer ? viewer.id === row.sellerId : false,
  };
}

function request(input, buyer) {
  const listingId = validate.integer(input.listingId, 'Listing', { min: 1 });
  if (!listingId) throw AppError.unprocessable('Listing is required.');

  const note = validate.text(input.note, 'Message to seller', { min: 0, max: 300, required: false });

  const listing = listingModel.findById(listingId);
  if (!listing) throw AppError.notFound('That listing does not exist.');
  if (listing.status !== 'available') {
    throw AppError.conflict('This listing is no longer available.');
  }
  if (listing.sellerId === buyer.id) {
    throw AppError.unprocessable('You cannot buy your own listing.');
  }
  if (orderModel.findPendingForListing(listingId)) {
    throw AppError.conflict('Someone already has a pending request for this listing.');
  }

  let order;
  try {
    order = orderModel.createWithReservation({
      listingId,
      buyerId: buyer.id,
      sellerId: listing.sellerId,
      amountCentavos: listing.priceCentavos,
      note: note || null,
    });
  } catch (error) {
    // The unique partial index is the final guard, even if two requests raced.
    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
      throw AppError.conflict('Someone already has a pending request for this listing.');
    }
    throw error;
  }

  return toApi(order, buyer);
}

function mine(viewer, view) {
  const selected = VIEWS.includes(view) ? view : 'all';
  let rows = [];

  if (selected === 'buying') rows = orderModel.listForBuyer(viewer.id);
  else if (selected === 'selling') rows = orderModel.listForSeller(viewer.id);
  else {
    const seen = new Set();
    for (const row of [...orderModel.listForBuyer(viewer.id), ...orderModel.listForSeller(viewer.id)]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  return {
    data: rows.map((row) => toApi(row, viewer)),
    view: selected,
    counts: {
      buying: orderModel.listForBuyer(viewer.id).length,
      selling: orderModel.listForSeller(viewer.id).length,
      pendingForSeller: orderModel.countPendingForSeller(viewer.id),
    },
  };
}

function update(id, viewer, input) {
  const action = validate.oneOf(input.action, ACTIONS, 'Action');
  const order = orderModel.findById(id);
  if (!order) throw AppError.notFound('That order does not exist.');

  const isBuyer = viewer.id === order.buyerId;
  const isSeller = viewer.id === order.sellerId;
  if (!isBuyer && !isSeller) throw AppError.forbidden('This order is not yours.');

  if (action === 'complete') {
    if (!isSeller) throw AppError.forbidden('Only the seller can confirm a sale.');
    if (order.status !== 'pending') throw AppError.conflict('This order is no longer pending.');
    return toApi(orderModel.completeWithListing(id), viewer);
  }

  if (order.status !== 'pending') throw AppError.conflict('Only a pending order can be cancelled.');
  return toApi(orderModel.cancelWithRelease(id), viewer);
}

function getById(id, viewer) {
  const order = orderModel.findById(id);
  if (!order) throw AppError.notFound('That order does not exist.');

  const isParty = viewer.id === order.buyerId || viewer.id === order.sellerId;
  if (!isParty && viewer.role !== 'admin') {
    throw AppError.forbidden('This order is not yours.');
  }
  return { ...toApi(order, viewer), map: mapService.publicConfig() };
}

/** Seller drops a pin on the map; the buyer will be asked to confirm it. */
function proposeMeetup(id, viewer, input) {
  const order = orderModel.findById(id);
  if (!order) throw AppError.notFound('That order does not exist.');
  if (order.sellerId !== viewer.id) {
    throw AppError.forbidden('Only the seller can set the meetup location.');
  }
  if (order.status !== 'pending') {
    throw AppError.conflict('Meetup details can only be set for a pending request.');
  }
  if (order.meetupStatus === 'confirmed') {
    throw AppError.conflict('This meetup is already confirmed.');
  }

  const latitude = coordinate(input.latitude, 'Latitude', -90, 90);
  const longitude = coordinate(input.longitude, 'Longitude', -180, 180);
  const label = validate.text(input.label, 'Meetup label', { min: 2, max: 80, required: false });

  return toApi(
    orderModel.proposeMeetup(id, { latitude, longitude, label: label || null }),
    viewer
  );
}

/** Buyer confirms the pin or asks the seller for another one. */
function respondMeetup(id, viewer, input) {
  const action = validate.oneOf(input.action, MEETUP_RESPONSES, 'Meetup action');

  const order = orderModel.findById(id);
  if (!order) throw AppError.notFound('That order does not exist.');
  if (order.buyerId !== viewer.id) {
    throw AppError.forbidden('Only the buyer can respond to a meetup location.');
  }
  if (order.status !== 'pending') {
    throw AppError.conflict('This order is no longer pending.');
  }
  if (order.meetupStatus !== 'proposed') {
    throw AppError.conflict('There is no meetup proposal to respond to.');
  }

  const status = action === 'confirm' ? 'confirmed' : 'rejected';
  return toApi(orderModel.respondMeetup(id, status), viewer);
}

module.exports = { request, mine, update, getById, proposeMeetup, respondMeetup, toApi };
