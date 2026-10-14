const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/tokens');

const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication is required.');

  let payload;
  try {
    payload = verifyToken(token, 'access');
  } catch {
    throw new AppError(401, 'Access token is invalid or expired.');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError(401, 'This access token is no longer valid.');
  }
  req.user = user;
  next();
});

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };
}

module.exports = { protect, allowRoles };
