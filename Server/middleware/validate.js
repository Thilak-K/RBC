const sendError = (res, status, message) => res.status(status).json({ success: false, error: message });

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return sendError(res, 400, error.details.map((d) => d.message).join(", "));
  next();
};

module.exports = { validate, sendError };