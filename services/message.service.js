/**
 * Conversation rules.
 *
 * A thread is (listing, buyer, seller). The seller always owns the listing, so
 * the buyer never has to pick a recipient — it is derived. A seller replying
 * must name the buyer, and that buyer must already be part of the conversation
 * or have ordered the listing.
 */
const AppError = require('../utils/AppError');
const validate = require('../utils/validate');
const messageModel = require('../models/message.model');
const listingModel = require('../models/listing.model');
const orderModel = require('../models/order.model');
const userModel = require('../models/user.model');

function toApi(row) {
  return {
    id: row.id,
    listingId: row.listingId,
    senderId: row.senderId,
    recipientId: row.recipientId,
    body: row.body,
    readAt: row.readAt,
    createdAt: row.createdAt,
    senderName: row.senderName,
  };
}

function send(viewer, input) {
  const listingId = validate.integer(input.listingId, 'Listing', { min: 1 });
  if (!listingId) throw AppError.unprocessable('Listing is required.');

  const body = validate.text(input.body, 'Message', { min: 1, max: 1000 });

  const listing = listingModel.findById(listingId);
  if (!listing) throw AppError.notFound('That listing does not exist.');

  let recipientId;

  if (listing.sellerId === viewer.id) {
    recipientId = validate.integer(input.recipientId, 'Recipient', { min: 1 });
    if (!recipientId) throw AppError.unprocessable('Choose who you are replying to.');
    if (recipientId === viewer.id) throw AppError.unprocessable('You cannot message yourself.');

    const recipient = userModel.findPublicById(recipientId);
    if (!recipient) throw AppError.notFound('That user does not exist.');

    const known = messageModel.existsBetween(listingId, viewer.id, recipientId)
      || orderModel.existsForListingAndBuyer(listingId, recipientId);
    if (!known) throw AppError.forbidden('That person has not contacted you about this listing.');
  } else {
    recipientId = listing.sellerId;
  }

  const row = messageModel.insert({ listingId, senderId: viewer.id, recipientId, body });
  return toApi(row);
}

function thread(viewer, listingId, partnerIdParam) {
  const listing = listingModel.findById(listingId);
  if (!listing) throw AppError.notFound('That listing does not exist.');

  const isSeller = listing.sellerId === viewer.id;
  let partnerId;

  if (isSeller) {
    partnerId = validate.integer(partnerIdParam, 'Conversation partner', { min: 1 });
    if (!partnerId) throw AppError.unprocessable('Choose a conversation to open.');
  } else {
    partnerId = listing.sellerId;
  }

  if (partnerId === viewer.id) throw AppError.unprocessable('You cannot message yourself.');

  const partner = userModel.findPublicById(partnerId);
  if (!partner) throw AppError.notFound('That user does not exist.');

  messageModel.markRead(listingId, viewer.id, partnerId);

  return {
    listing: {
      id: listing.id,
      title: listing.title,
      price: listing.priceCentavos / 100,
      status: listing.status,
      imagePath: listing.imagePath,
      sellerId: listing.sellerId,
    },
    partner: {
      id: partner.id,
      name: partner.fullName,
      program: partner.program,
      yearLevel: partner.yearLevel,
    },
    messages: messageModel.listBetween(listing.id, viewer.id, partnerId).map(toApi),
  };
}

function threads(viewer) {
  return {
    data: messageModel.threadsFor(viewer.id).map((row) => ({
      listingId: row.listingId,
      partnerId: row.partnerId,
      partnerName: row.partnerName,
      listingTitle: row.listingTitle,
      listingImage: row.listingImage,
      price: row.priceCentavos / 100,
      listingStatus: row.listingStatus,
      lastBody: row.lastBody,
      lastAt: row.lastAt,
      messageCount: row.messageCount,
      unread: row.unread,
    })),
    unread: messageModel.unreadCount(viewer.id),
  };
}

function unread(viewer) {
  return { count: messageModel.unreadCount(viewer.id) };
}

module.exports = { send, thread, threads, unread, toApi };
