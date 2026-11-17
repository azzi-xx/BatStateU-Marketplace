/**
 * An error we deliberately throw with an HTTP status attached.
 * The central error handler turns this into a clean JSON response.
 */
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }

  static badRequest(message) {
    return new AppError(400, message);
  }

  static unauthorized(message = 'Please log in to continue.') {
    return new AppError(401, message);
  }

  static forbidden(message = 'You do not have permission to do that.') {
    return new AppError(403, message);
  }

  static notFound(message = 'Not found.') {
    return new AppError(404, message);
  }

  static conflict(message) {
    return new AppError(409, message);
  }

  static unprocessable(message) {
    return new AppError(422, message);
  }
}

module.exports = AppError;
