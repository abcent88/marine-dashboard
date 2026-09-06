const { randomUUID } = require("crypto");

const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function requestId(req, res, next) {
  const incomingRequestId = req.get("x-request-id");

  const isValidRequestId =
    typeof incomingRequestId === "string" &&
    incomingRequestId.length > 0 &&
    incomingRequestId.length <= MAX_REQUEST_ID_LENGTH &&
    REQUEST_ID_PATTERN.test(incomingRequestId);

  const id = isValidRequestId ? incomingRequestId : randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-Id", id);

  next();
}

module.exports = requestId;
