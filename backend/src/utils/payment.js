const PAYMENT_PHONE = '0968955959';
const WHATSAPP_PHONE = '0968955959';
const WHATSAPP_PAYMENT_PROOF_URL = 'https://wa.me/260968955959';

function getPaymentInstructions() {
  return {
    paymentPhone: PAYMENT_PHONE,
    whatsappPhone: WHATSAPP_PHONE,
    whatsappUrl: WHATSAPP_PAYMENT_PROOF_URL,
    warning: 'Use the same phone number you registered with to avoid activation delays.',
    steps: [
      `Pay via Mobile Money to: ${PAYMENT_PHONE}`,
      'Use your registered phone number as the payment reference where possible.',
      `After payment, send proof on WhatsApp to: ${WHATSAPP_PHONE}`,
      'Include your full name, registered phone number, selected package, and transaction ID or payment reference.',
      'Your account will be activated after confirmation.',
    ],
  };
}

module.exports = {
  PAYMENT_PHONE,
  WHATSAPP_PHONE,
  WHATSAPP_PAYMENT_PROOF_URL,
  getPaymentInstructions,
};
