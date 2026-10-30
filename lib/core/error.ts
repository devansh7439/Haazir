// The one error type a route turns into a JSON error. The console and the tests rely on `code`, so codes never change.

type Details = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Details = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 400: the request could not be read at all. */
  static badRequest(code: string, message: string): ApiError {
    return new ApiError(400, code, message);
  }

  /** 401: no session, or a session that is no longer valid. */
  static unauthorized(message: string): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  /** 403: signed in, but not allowed to do this. */
  static forbidden(message: string): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  /** 404: missing, or in another organisation (reported the same way, so ids can't be probed). */
  static notFound(message: string): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  /** 409: the request is valid, but the row is not in a state that allows it. */
  static conflict(code: string, message: string, details?: Details): ApiError {
    return new ApiError(409, code, message, details);
  }

  /** 415: the body is not application/json. */
  static unsupportedMediaType(message: string): ApiError {
    return new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", message);
  }

  /** 422: the body was read but a value in it is wrong. */
  static unprocessable(code: string, message: string, details?: Details): ApiError {
    return new ApiError(422, code, message, details);
  }

  /** 429: a limit that protects hospitals or the account was reached. */
  static tooMany(code: string, message: string): ApiError {
    return new ApiError(429, code, message);
  }

  /** 500: something the server should have prevented. The message is shown, so it must not hold identifiers. */
  static internal(code: string, message: string): ApiError {
    return new ApiError(500, code, message);
  }
}
