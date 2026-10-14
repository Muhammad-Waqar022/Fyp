const express = require('express');
const controller = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const validators = require('../validators/orderValidators');

const router = express.Router();
router.use(protect);
router.post('/', validators.create, validate, controller.create);
router.get('/', controller.list);
router.get('/:id', validators.idParam, validate, controller.getById);

module.exports = router;
