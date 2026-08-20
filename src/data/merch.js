/**
 * Merch details sourced from bluemountainxccamp.com/faq.html.
 *
 * BMXC merch is sold in person at camp only — there is no online store and
 * no preorder — so this page is informational rather than a storefront.
 */

export const MERCH = {
  priceRange: { min: 15, max: 40 },
  typicalSpend: { min: 75, max: 100 },
  canteenPrice: { min: 1, max: 3 },
};

/** The facts campers and parents actually need before arriving. */
export const MERCH_FACTS = [
  {
    title: 'Cash only',
    body: 'We only accept cash for BMXC merchandise. There is no ATM at camp, so bring what you plan to spend. The one exception: if we partner with a shoe store for a pop-up shop, they typically take credit cards.',
    tag: 'Payment',
  },
  {
    title: 'Sold in person, at camp',
    body: 'Merch is only available in person during camp week. We do not offer preorders or online ordering at this time.',
    tag: 'Where',
  },
  {
    title: 'First come, first served',
    body: 'Merch is sold at various times during the week and every sale is announced ahead of time. Quantities, sizes, and styles are all limited.',
    tag: 'When',
  },
  {
    title: 'Reasonable prices',
    body: 'Items typically run $15-40 each. Most campers who buy a few things — merch plus late-night snacks from the Canteen — spend somewhere around $75-100 across the week.',
    tag: 'Cost',
  },
];

/**
 * The apparel line, sourced from bluemountainxccamp.com/apparel.html —
 * product photos, materials, and colours are the camp's own.
 *
 * The camp does NOT publish per-item prices, only a $15-40 range across all
 * merch. `priceNote` positions each item inside that range without implying
 * a quoted figure. The page states this explicitly.
 */
export const MERCH_ITEMS = [
  {
    id: 'hoodie',
    name: 'BMXC Hoodie',
    fit: 'Unisex',
    material: '100% cotton',
    color: 'Royal Blue',
    note: 'The most iconic item at camp, and the one campers come back for. It sells out every single year.',
    image: '/merch/hoodie.jpg',
    priceNote: 'Top of the range',
    tag: 'Most iconic',
    hero: true,
  },
  {
    id: 'singlet',
    name: 'BMXC Singlet',
    fit: "Unisex and women's",
    material: '100% polyester wicking knit',
    color: 'Varies by year',
    note: 'Race-ready wicking knit carrying the mountain logo. Colours are set fresh each summer.',
    image: '/merch/singlet.jpg',
    priceNote: 'Mid range',
    tag: 'Apparel',
  },
  {
    id: 'eat-run-sleep',
    name: 'EAT-RUN-SLEEP Singlet',
    fit: 'Unisex',
    material: '100% polyester wicking knit',
    color: 'Varies by year',
    note: 'The camp mantra down the front, mountain logo on the back.',
    image: '/merch/eat-run-sleep.jpg',
    priceNote: 'Mid range',
    tag: 'Apparel',
  },
];

/** Shirts campers receive or earn rather than buy. */
export const INCLUDED_SHIRTS = [
  {
    title: 'Limited edition camper tee',
    body: 'Every camper gets one free. A new design every summer.',
  },
  {
    title: 'Camp Champion tee',
    body: 'Not for sale at any price — these are won by taking on camp challenges during the week.',
  },
];

/** Caveats the camp states directly on its apparel page. */
export const MERCH_CAVEATS = [
  'Offerings may vary from what is shown without notice, including styles, colour, size, and price.',
  'No pre-orders or reservations.',
  'Availability is limited.',
];

/** Prizes are given away, not sold — worth distinguishing on this page. */
export const GIVEAWAYS = {
  body: 'We run hundreds of giveaways during the week — BMXC merch, custom one-of-a-kind BMXC blankets, and specialty running gear. Every time a camper attends an optional info-session, they earn one entry into the prize drawing.',
};
