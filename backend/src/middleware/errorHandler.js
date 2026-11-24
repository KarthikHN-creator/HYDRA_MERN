function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  let status = error.status || 500
  let code = error.code || 'INTERNAL_SERVER_ERROR'
  let message = error.message || 'An unexpected error occurred'
  let details = error.details

  if (error.type === 'entity.parse.failed') {
    status = 400
    code = 'INVALID_JSON'
    message = 'Request body must contain valid JSON'
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400
    code = 'VALIDATION_ERROR'
    message = 'Request data failed validation'
    details = error.errors
      ? Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }))
      : [{ field: error.path, message: error.message }]
  } else if (error.code === 11000) {
    status = 409
    code = 'DUPLICATE_RECORD'
    message = 'A record with these unique fields already exists'
    details = error.keyValue
  }

  if (status >= 500 && status !== 503) console.error(error)

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  })
}

module.exports = errorHandler
