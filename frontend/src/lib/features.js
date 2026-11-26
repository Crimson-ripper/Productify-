// Site-wide feature switches.
// Digital-products marketplace (Shop, Sell, bag, orders): paused by the owner on 2026-11-26
// "until further notice". Set REACT_APP_MARKETPLACE_ENABLED=true at build time to bring it back.
// GPU hosting in Seller Studio is not affected.
export const MARKETPLACE_ENABLED = process.env.REACT_APP_MARKETPLACE_ENABLED === "true";
