/**
 * Business logic for listings: validation, ownership rules, and mapping
 * database rows into the shape the front-end consumes.
 */
const AppError = require('../utils/AppError');
const validate = require('../utils/validate');
const { removeUpload } = require('../utils/files');
const listingModel = require('../models/listing.model');
const categoryModel = require('../models/category.model');
const orderModel = require('../models/order.model');

const CONDITIONS = ['new', 'like_new', 'used', 'for_parts'];
const MAX_PAGE_SIZE = 48;

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.priceCentavos / 100,
    condition: row.itemCondition,
    imagePath: row.imagePath,
    status: row.status,
    views: row.views,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    seller: {
      id: row.sellerId,
      name: row.sellerName,
      program: row.sellerProgram,
      yearLevel: row.sellerYearLevel,
    },
  };
}

function positiveInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

function browse(query = {}, viewer = null) {
  const page = positiveInt(query.page, 1);
  const limit = positiveInt(query.limit, 12, MAX_PAGE_SIZE);
  const sort = listingModel.SORT_MAP[query.sort] ? query.sort : 'newest';
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 80) : '';
  const categorySlug = typeof query.category === 'string' ? query.category.trim() : '';
  const onlyMine = query.mine === '1' || query.mine === 'true';

  if (onlyMine && !viewer) throw AppError.unauthorized();

  const { rows, total } = listingModel.list({
    q: q || undefined,
    categorySlug: categorySlug || undefined,
    sellerId: onlyMine ? viewer.id : undefined,
    sort,
    limit,
    offset: (page - 1) * limit,
  });

  return {
    data: rows.map(toApi),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function getById(id, viewer = null) {
  const row = listingModel.findById(id);
  if (!row) throw AppError.notFound('That listing does not exist.');

  const isOwner = viewer && viewer.id === row.sellerId;
  const isAdmin = viewer && viewer.role === 'admin';
  if (row.status === 'removed' && !isOwner && !isAdmin) {
    throw AppError.notFound('That listing is no longer available.');
  }

  listingModel.incrementViews(row.id);

  // The detail page needs three pieces of order context:
  //  - viewerOrder     : the current buyer's own pending request (so it can cancel)
  //  - incomingRequest : the seller's pending request (so it can confirm)
  // The listing row itself only knows "reserved"; these explain why.
  const pending = orderModel.findPendingForListing(row.id);

  const viewerOrder =
    pending && viewer && pending.buyerId === viewer.id
      ? {
          id: pending.id,
          status: pending.status,
          amount: pending.amountCentavos / 100,
          createdAt: pending.createdAt,
        }
      : null;

  const incomingRequest =
    pending && isOwner
      ? {
          id: pending.id,
          buyerId: pending.buyerId,
          buyerName: pending.buyerName,
          note: pending.note,
          createdAt: pending.createdAt,
        }
      : null;

  return {
    ...toApi(row),
    views: row.views + 1,
    isOwner: Boolean(isOwner),
    viewerOrder,
    incomingRequest,
  };
}

function normalizeFields(input, { partial }) {
  const fields = {};

  if (!partial || input.title !== undefined) {
    fields.title = validate.text(input.title, 'Title', { min: 4, max: 90 });
  }
  if (!partial || input.description !== undefined) {
    fields.description = validate.text(input.description, 'Description', {
      min: 0,
      max: 2000,
      required: false,
    });
  }
  if (!partial || input.price !== undefined) {
    fields.priceCentavos = validate.money(input.price, 'Price');
  }
  if (!partial || input.condition !== undefined) {
    fields.itemCondition = validate.oneOf(input.condition, CONDITIONS, 'Condition');
  }
  if (!partial || input.categoryId !== undefined) {
    const categoryId = validate.integer(input.categoryId, 'Category', { min: 1 });
    if (!categoryId || !categoryModel.findById(categoryId)) {
      throw AppError.unprocessable('Please choose a valid category.');
    }
    fields.categoryId = categoryId;
  }

  return fields;
}

function create(input, seller, file) {
  const fields = normalizeFields(input, { partial: false });

  const row = listingModel.insert({
    sellerId: seller.id,
    categoryId: fields.categoryId,
    title: fields.title,
    description: fields.description,
    priceCentavos: fields.priceCentavos,
    itemCondition: fields.itemCondition,
    imagePath: file ? `/uploads/${file.filename}` : null,
  });

  return toApi(row);
}

function update(id, input, viewer, file) {
  const existing = listingModel.findById(id);
  if (!existing) throw AppError.notFound('That listing does not exist.');

  if (existing.sellerId !== viewer.id && viewer.role !== 'admin') {
    throw AppError.forbidden('You can only edit your own listings.');
  }
  if (existing.status === 'sold') {
    throw AppError.conflict('Sold listings can no longer be edited.');
  }

  const fields = normalizeFields(input, { partial: false });

  const row = listingModel.update(id, {
    categoryId: fields.categoryId,
    title: fields.title,
    description: fields.description,
    priceCentavos: fields.priceCentavos,
    itemCondition: fields.itemCondition,
    imagePath: file ? `/uploads/${file.filename}` : null,
  });

  if (file && existing.imagePath) removeUpload(existing.imagePath);

  return toApi(row);
}

function remove(id, viewer) {
  const existing = listingModel.findById(id);
  if (!existing) throw AppError.notFound('That listing does not exist.');

  if (existing.sellerId !== viewer.id && viewer.role !== 'admin') {
    throw AppError.forbidden('You can only delete your own listings.');
  }

  // Soft delete: the row stays so future order history keeps working,
  // but the photo is no longer referenced anywhere.
  const row = listingModel.setStatus(id, 'removed');
  removeUpload(existing.imagePath);
  return toApi(row);
}

module.exports = {
  browse,
  getById,
  create,
  update,
  remove,
  toApi,
  CONDITIONS,
};
