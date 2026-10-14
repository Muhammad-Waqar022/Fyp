const Product = require('../models/Product');

async function releaseInventory(order) {
  if (order.inventoryReleased) return false;

  const claimed = await order.constructor.findOneAndUpdate(
    { _id: order._id, inventoryReleased: false, status: { $in: ['payment_failed', 'expired', 'cancelled'] } },
    { $set: { inventoryReleased: true } },
    { returnDocument: 'after' }
  );
  if (!claimed) return false;

  try {
    for (const item of claimed.items) {
      const result = await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: item.quantity } }
      );
      if (result.matchedCount !== 1) throw new Error(`Cannot restore stock for product ${item.product}.`);
    }
  } catch (error) {
    await order.constructor.updateOne(
      { _id: order._id, inventoryReleased: true },
      { $set: { inventoryReleased: false } }
    );
    throw error;
  }
  return true;
}

module.exports = { releaseInventory };
