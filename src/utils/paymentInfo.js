// Nigerian bank list for withdrawal bank selection — unchanged from the
// original VIDEARN spec.
export const BANKS = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank",
  "First Bank of Nigeria", "First City Monument Bank (FCMB)", "Globus Bank",
  "Guaranty Trust Bank (GTBank)", "Heritage Bank", "Jaiz Bank", "Keystone Bank",
  "Kuda Bank", "Lotus Bank", "Moniepoint Microfinance Bank", "OPay", "PalmPay",
  "Parallex Bank", "Polaris Bank", "Premium Trust Bank", "Providus Bank",
  "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank", "SunTrust Bank",
  "Titan Trust Bank", "Union Bank of Nigeria", "United Bank for Africa (UBA)",
  "Unity Bank", "VFD Microfinance Bank", "Wema Bank", "Zenith Bank",
];

// OPay account details for manual deposits — unchanged from the original spec.
export const OPAY_DETAILS = {
  bank: "OPay",
  accountNumber: "7042649274",
  accountName: "Aduma Pleasure John",
};

// Withdrawal window: 8:00 AM - 10:00 PM WAT (Nigeria, UTC+1, no DST).
export function isWithinWithdrawalHours() {
  const now = new Date();
  const utcH = now.getUTCHours();
  const watH = (utcH + 1) % 24;
  return watH >= 8 && watH < 22;
}
