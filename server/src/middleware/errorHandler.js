// ─── CUSTOM ERROR CLASS ───────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes known errors from unexpected crashes
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── PRISMA ERROR MAPPER ──────────────────────────────────────────────────────
// Converts Prisma-specific error codes into clean HTTP responses
// so controllers never need to handle raw Prisma errors.

const handlePrismaError = (err) => {
  switch (err.code) {
    case "P2002":
      // Unique constraint violation (e.g. duplicate email, duplicate bid)
      return new AppError(
        `A record with that ${err.meta?.target?.join(", ")} already exists.`,
        409
      );
    case "P2025":
      // Record not found (e.g. findUniqueOrThrow failed)
      return new AppError("The requested record was not found.", 404);
    case "P2003":
      // Foreign key constraint failed
      return new AppError("Related record does not exist.", 400);
    case "P2014":
      // Relation violation
      return new AppError("Invalid relation between records.", 400);
    default:
      return new AppError("A database error occurred.", 500);
  }
};

// ─── JWT ERROR MAPPER ─────────────────────────────────────────────────────────

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", 401);

const handleJWTExpiredError = () =>
  new AppError("Your session has expired. Please log in again.", 401);

// ─── DEV VS PROD RESPONSE ────────────────────────────────────────────────────

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: "error",
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    // Known, safe error — send message to client
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
  } else {
    // Unknown error — don't leak details
    console.error("UNEXPECTED ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong. Please try again later.",
    });
  }
};

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // Map known error types before responding
  let error = err;

  if (err.name === "PrismaClientKnownRequestError") {
    error = handlePrismaError(err);
  } else if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  } else if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  } else if (err.name === "ValidationError") {
    error = new AppError(err.message, 400);
  }

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};