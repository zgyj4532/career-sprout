import { ApiError } from '../middleware/errorHandler.js';

export function campusError(status, code, message) {
  const error = new ApiError(status, message);
  error.code = code;
  error.safeMessage = message;
  return error;
}
