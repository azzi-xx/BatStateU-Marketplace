/**
 * Wraps each request in a query-log trace context. Mounted before `attachUser`
 * so even the session's user lookup is attributed to the request that caused it.
 */
const queryLog = require('../utils/queryLog');

function traceQueries(req, _res, next) {
  queryLog.runWithRequest(req, next);
}

module.exports = { traceQueries };
