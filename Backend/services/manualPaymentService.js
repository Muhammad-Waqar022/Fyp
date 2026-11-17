const labels = {
  cash_on_delivery: 'Cash on delivery',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  bank_transfer: 'Bank transfer',
};

function getPaymentOption(method) {
  if (method === 'cash_on_delivery') {
    return {
      id: method,
      label: labels[method],
      enabled: true,
      instructions: 'Pay the order total in cash when your order is delivered.',
      accountDetails: null,
    };
  }

  let accountDetails;
  let configured;
  if (method === 'jazzcash') {
    accountDetails = {
      accountTitle: process.env.JAZZCASH_ACCOUNT_TITLE || '',
      accountNumber: process.env.JAZZCASH_ACCOUNT_NUMBER || '',
    };
    configured = Boolean(accountDetails.accountTitle && accountDetails.accountNumber);
  } else if (method === 'easypaisa') {
    accountDetails = {
      accountTitle: process.env.EASYPAISA_ACCOUNT_TITLE || '',
      accountNumber: process.env.EASYPAISA_ACCOUNT_NUMBER || '',
    };
    configured = Boolean(accountDetails.accountTitle && accountDetails.accountNumber);
  } else if (method === 'bank_transfer') {
    accountDetails = {
      accountTitle: process.env.BANK_ACCOUNT_TITLE || '',
      bankName: process.env.BANK_NAME || '',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
      iban: process.env.BANK_IBAN || '',
    };
    configured = Boolean(
      accountDetails.accountTitle &&
      accountDetails.bankName &&
      (accountDetails.accountNumber || accountDetails.iban)
    );
  } else {
    return null;
  }

  return {
    id: method,
    label: labels[method],
    enabled: configured,
    instructions: configured
      ? 'Transfer the exact order total, then submit the transaction reference for administrator confirmation.'
      : 'This payment option is not configured yet.',
    accountDetails: configured ? accountDetails : null,
  };
}

function getPaymentOptions() {
  return Object.keys(labels).map(getPaymentOption);
}

function presentPayment(payment) {
  const option = getPaymentOption(payment.method);
  return {
    id: payment.id,
    order: payment.order,
    method: payment.method,
    label: option ? option.label : 'Legacy payment (unsupported)',
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    instructions: option
      ? option.instructions
      : 'This payment was created before manual payment options were enabled.',
    accountDetails: option ? option.accountDetails : null,
    transactionReference: payment.transactionReference,
    submittedAt: payment.submittedAt,
    reviewedAt: payment.reviewedAt,
    reviewNote: payment.reviewNote,
  };
}

module.exports = { getPaymentOption, getPaymentOptions, presentPayment };
