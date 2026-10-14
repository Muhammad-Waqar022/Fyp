const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const uploadDirectory = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const imageSignatures = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
};
const extensionsByMimeType = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!extensionsByMimeType[file.mimetype]) {
      return callback(new AppError(400, 'Product images must be JPEG, PNG, or WebP files.'));
    }
    callback(null, true);
  },
}).single('image');

function uploadProductImage(req, res, next) {
  upload(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) return next();
    if (!imageSignatures[req.file.mimetype](req.file.buffer)) {
      return next(new AppError(400, 'The uploaded file content is not a valid JPEG, PNG, or WebP image.'));
    }

    req.file.filename = `${crypto.randomBytes(16).toString('hex')}${extensionsByMimeType[req.file.mimetype]}`;
    next();
  });
}

function saveUploadedImage(req, res, next) {
  if (!req.file) return next();
  fs.promises.writeFile(
    path.join(uploadDirectory, req.file.filename),
    req.file.buffer,
    { flag: 'wx' }
  ).then(() => next(), next);
}

async function removeUploadedImage(file) {
  if (!file || !file.filename) return;
  try {
    await fs.promises.unlink(path.join(uploadDirectory, file.filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = { uploadProductImage, saveUploadedImage, removeUploadedImage, uploadDirectory };
