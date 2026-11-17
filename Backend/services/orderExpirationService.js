const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { releaseInventory } = require('./inventoryService');

async function expirePendingOrders(now = new Date()) {
  const pendingOrders = await Order.find({
    status: 'pending_payment',
    paymentStatus: 'pending',
    paymentMethod: { $ne: 'cash_on_delivery' },
    reservationExpiresAt: { $lte: now },
  }).limit(100);

  let expiredCount = 0;
  for (const order of pendingOrders) {
    const expiredOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentMethod: { $ne: 'cash_on_delivery' },
        reservationExpiresAt: { $lte: now },
      },
      { $set: { status: 'expired', paymentStatus: 'expired' } },
      { returnDocument: 'after' }
    );
    if (!expiredOrder) continue;

    await Payment.updateOne(
      { order: expiredOrder._id, status: { $in: ['pending', 'submitted'] } },
      { $set: { status: 'expired' } }
    );
    await releaseInventory(expiredOrder);
    expiredCount += 1;
  }
  return expiredCount;
}

function startOrderExpirationJob() {
  let running = false;
  let activeRun = Promise.resolve();
  const run = async () => {
    if (running) return;
    running = true;
    activeRun = (async () => {
      try {
        const count = await expirePendingOrders();
        if (count > 0) console.log(`Expired ${count} unpaid order reservation(s).`);
      } catch (error) {
        console.error('Order expiration job failed:', error.name);
      } finally {
        running = false;
      }
    })();
    await activeRun;
  };

  void run();
  const timer = setInterval(run, 60 * 1000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await activeRun;
  };
}

module.exports = { expirePendingOrders, startOrderExpirationJob };
