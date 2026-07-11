// Canonical VIP plan data — single source of truth. Flat daily earnings only,
// no percentage/compound interest, per the original VIDEARN spec. Any
// component that needs to display or calculate against VIP plans should
// import from here rather than redefining these numbers.
export const VIPS = {
  vip1: { id: "vip1", label: "VIP 1", amount: 7000, daily: 900, color: "#2ECC71" },
  vip2: { id: "vip2", label: "VIP 2", amount: 12000, daily: 1200, color: "#27AE60" },
  vip3: { id: "vip3", label: "VIP 3", amount: 18000, daily: 2000, color: "#1E8449" },
  vip4: { id: "vip4", label: "VIP 4", amount: 25000, daily: 2600, color: "#A4E86B" },
  vip5: { id: "vip5", label: "VIP 5", amount: 59000, daily: 3500, color: "#58D68D" },
  vip6: { id: "vip6", label: "VIP 6", amount: 100000, daily: 5000, color: "#0E6B3A" },
};

export const VIP_LIST = Object.values(VIPS);
