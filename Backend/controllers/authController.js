const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { createTokenPair, verifyToken, hashToken } = require('../utils/tokens');

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function issueTokens(user) {
  const tokens = createTokenPair(user);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();
  return tokens;
}

exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await User.create({ firstName, lastName, email, password });
  const tokens = await issueTokens(user);
  res.status(201).json({
    success: true,
    data: { user: publicUser(user), ...tokens },
  });
});

exports.login = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).select('+password +tokenVersion +refreshTokenHash');
  if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) {
    return next(new AppError(401, 'Invalid email or password.'));
  }

  const tokens = await issueTokens(user);
  res.status(200).json({ success: true, data: { user: publicUser(user), ...tokens } });
});

exports.refresh = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError(400, 'Refresh token is required.'));

  let payload;
  try {
    payload = verifyToken(refreshToken, 'refresh');
  } catch {
    return next(new AppError(401, 'Refresh token is invalid or expired.'));
  }
  if (payload.type !== 'refresh') return next(new AppError(401, 'Refresh token is invalid.'));

  const user = await User.findById(payload.sub).select('+tokenVersion +refreshTokenHash');
  if (
    !user ||
    !user.isActive ||
    user.tokenVersion !== payload.tokenVersion ||
    !user.refreshTokenHash ||
    !crypto.timingSafeEqual(
      Buffer.from(user.refreshTokenHash),
      Buffer.from(hashToken(refreshToken))
    )
  ) {
    return next(new AppError(401, 'Refresh token has been revoked or replaced.'));
  }

  const tokens = await issueTokens(user);
  res.status(200).json({ success: true, data: tokens });
});

exports.logout = asyncHandler(async (req, res) => {
  req.user.tokenVersion += 1;
  req.user.refreshTokenHash = undefined;
  await req.user.save();
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: publicUser(req.user) } });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  if (req.body.firstName !== undefined) req.user.firstName = req.body.firstName;
  if (req.body.lastName !== undefined) req.user.lastName = req.body.lastName;
  await req.user.save();
  res.status(200).json({ success: true, data: { user: publicUser(req.user) } });
});

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password +tokenVersion');
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError(400, 'Current password is incorrect.'));
  }
  if (typeof newPassword !== 'string' || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
    return next(new AppError(400, 'New password must be at least 8 characters and include uppercase, lowercase, and a number.'));
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  user.refreshTokenHash = undefined;
  await user.save();
  res.status(200).json({ success: true, message: 'Password changed. Please log in again.' });
});

exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email }).select('+tokenVersion');
  const response = {
    success: true,
    message: 'If an account exists for that email, password reset instructions are available.',
  };

  if (user && user.isActive) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    if (process.env.NODE_ENV !== 'production') response.resetToken = resetToken;
  }
  res.status(200).json(response);
});

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token, newPassword } = req.body;
  if (typeof token !== 'string' || typeof newPassword !== 'string') {
    return next(new AppError(400, 'Reset token and new password are required.'));
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
    return next(new AppError(400, 'New password must be at least 8 characters and include uppercase, lowercase, and a number.'));
  }
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
    isActive: true,
  }).select('+passwordResetTokenHash +passwordResetExpires +tokenVersion');
  if (!user) return next(new AppError(400, 'Password reset token is invalid or expired.'));

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined;
  user.tokenVersion += 1;
  await user.save();
  res.status(200).json({ success: true, message: 'Password reset successfully. Please log in.' });
});
