const { body } = require('express-validator');

const register = [
  body('firstName').trim().isLength({ min: 1, max: 80 }).withMessage('First name is required (maximum 80 characters).'),
  body('lastName').trim().isLength({ min: 1, max: 80 }).withMessage('Last name is required (maximum 80 characters).'),
  body('email').trim().isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  body('password').isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 }).withMessage('Password must be at least 8 characters and include uppercase, lowercase, and a number.'),
];

const login = [
  body('email').trim().isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

const profile = [
  body('firstName').optional().trim().isLength({ min: 1, max: 80 }).withMessage('First name must be 1-80 characters.'),
  body('lastName').optional().trim().isLength({ min: 1, max: 80 }).withMessage('Last name must be 1-80 characters.'),
  body('email').not().exists().withMessage('Email cannot be changed using this endpoint.'),
  body('role').not().exists().withMessage('Role cannot be changed using this endpoint.'),
  body('isActive').not().exists().withMessage('Account status cannot be changed using this endpoint.'),
];

module.exports = { register, login, profile };
