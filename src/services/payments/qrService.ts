export const qrService = {
  generateRiderQR: (riderId: string, amount?: string, note?: string) => {
    const data = `cravix_pay:${riderId}?amt=${amount || ''}&note=${encodeURIComponent(note || '')}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}&color=1800ad&bgcolor=ffffff`;
  },
  validateMerchantQR: (data: string) => {
    // Basic validation logic
    return data.startsWith('cravix_pay:') || data.startsWith('upi://pay');
  }
};
