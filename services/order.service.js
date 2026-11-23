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

const ACTIONS = ['complete', 'cancel'];
const VIEWS = ['buying', 'selling', 'all'];

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
    },
    buyer: { id: row.buyerId, name: row.buyerName },
    seller: { id: row.sellerId, name: row.sellerName },
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

module.exports = { request, mine, update, toApi };
