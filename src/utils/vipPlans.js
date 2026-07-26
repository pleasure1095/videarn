// Canonical VIP plan data — single source of truth. Flat daily earnings only,
// no percentage/compound interest. Any component that needs to display or
// calculate against VIP plans should import from here rather than
// redefining these numbers.
//
// Expanded from 6 to 9 tiers per the site owner's pricing update. Names
// are original (VIP Starter -> VIP Sovereign), not tied to any reference
// design's branding.
export const VIPS = {
  vip1: { id: "vip1", label: "VIP Starter", amount: 3000, daily: 650, color: "#3DBE6C" },
  vip2: { id: "vip2", label: "VIP Builder", amount: 5000, daily: 850, color: "#2FAE64" },
  vip3: { id: "vip3", label: "VIP Growth", amount: 10000, daily: 1600, color: "#3D5FA8" },
  vip4: { id: "vip4", label: "VIP Prime", amount: 20000, daily: 3100, color: "#9E4A5C" },
  vip5: { id: "vip5", label: "VIP Elite", amount: 50000, daily: 7500, color: "#D4506A" },
  vip6: { id: "vip6", label: "VIP Premier", amount: 80000, daily: 12000, color: "#B8283D" },
  vip7: { id: "vip7", label: "VIP Executive", amount: 120000, daily: 17500, color: "#8C1E2E" },
  vip8: { id: "vip8", label: "VIP Diamond", amount: 200000, daily: 38000, color: "#6E1522" },
  vip9: { id: "vip9", label: "VIP Sovereign", amount: 250000, daily: 46000, color: "#4A0E17" },
};

export const VIP_LIST = Object.values(VIPS);
