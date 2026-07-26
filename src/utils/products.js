// Static product set for Daily Reviews. Kept as code (not a Firestore
// collection) since this is a small, curator-controlled rotation — like
// utils/articles.js was for the earlier Read to Earn feature. A day's
// featured set is chosen deterministically from this pool so every user
// sees the same products on the same day, as required.
export const PRODUCTS = [
  { id: "p1", name: "Wireless Earbuds Pro", category: "Gadgets", emoji: "🎧" },
  { id: "p2", name: "Smart Fitness Watch", category: "Watches", emoji: "⌚" },
  { id: "p3", name: "Portable Power Bank 20000mAh", category: "Gadgets", emoji: "🔋" },
  { id: "p4", name: "Classic Leather Wristwatch", category: "Watches", emoji: "⌚" },
  { id: "p5", name: "Bluetooth Speaker Mini", category: "Gadgets", emoji: "🔊" },
  { id: "p6", name: "LED Desk Lamp", category: "Home", emoji: "💡" },
  { id: "p7", name: "USB-C Fast Charger", category: "Gadgets", emoji: "🔌" },
  { id: "p8", name: "Digital Sports Watch", category: "Watches", emoji: "⌚" },
  { id: "p9", name: "Wireless Phone Charger Pad", category: "Gadgets", emoji: "📱" },
  { id: "p10", name: "Compact Travel Backpack", category: "Accessories", emoji: "🎒" },
  { id: "p11", name: "Noise-Cancelling Headphones", category: "Gadgets", emoji: "🎧" },
  { id: "p12", name: "Minimalist Steel Watch", category: "Watches", emoji: "⌚" },
];

const PRODUCTS_PER_DAY = 3;

/**
 * Deterministically picks a fixed set of products for a given day-index,
 * so every user sees the identical set on the same calendar day —
 * required per spec, since this isn't a personalized feed.
 */
export function getTodaysProducts(dayIndex) {
  const start = (dayIndex * PRODUCTS_PER_DAY) % PRODUCTS.length;
  const picked = [];
  for (let i = 0; i < PRODUCTS_PER_DAY; i++) {
    picked.push(PRODUCTS[(start + i) % PRODUCTS.length]);
  }
  return picked;
}
