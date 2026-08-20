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

/** Merch facts, taken from the camp's FAQ and apparel page. */
export const MERCH_FACTS = [
  {
    title: 'Cash only',
    body: 'We only accept cash for BMXC merchandise, and there is no ATM at camp. If we partner with a shoe store for a pop-up shop, they usually take credit cards.',
    tag: 'Payment',
  },
  {
    title: 'Available during the week of camp',
    body: 'Merch is sold in person at camp. No pre-orders, no reservations, and no online ordering.',
    tag: 'Where',
  },
  {
    title: 'Availability is limited',
    body: 'Merch is sold at various times during the week, and every sale is announced ahead of time. Quantities, sizes, and styles are limited, and it is first come, first served.',
    tag: 'When',
  },
  {
    title: 'Items are $15-40 each',
    body: 'Most campers spend about $75-100 over the week on merchandise and snacks from the Canteen.',
    tag: 'Cost',
  },
];

/**
 * The apparel line, sourced from bluemountainxccamp.com/apparel.html —
 * product photos, materials, and colours are the camp's own.
 *
 * The camp does not publish per-item prices, only a $15-40 range across all
 * merch, so no per-item price is shown.
 */
export const MERCH_ITEMS = [
  {
    id: 'hoodie',
    name: 'BMXC Hoodie',
    fit: 'Unisex',
    material: '100% cotton',
    color: 'Royal Blue',
    note: 'Our most popular item. Sizes go quickly.',
    image: '/merch/hoodie.jpg',
    tag: 'Hoodie',
    hero: true,
  },
  {
    id: 'singlet',
    name: 'BMXC Singlet',
    fit: "Unisex and women's",
    material: '100% polyester wicking knit',
    color: 'TBD for this year',
    note: 'Wicking knit singlet with the BMXC logo on the front.',
    image: '/merch/singlet.jpg',
    tag: 'Singlet',
  },
  {
    id: 'eat-run-sleep',
    name: 'EAT-RUN-SLEEP Singlet',
    fit: 'Unisex',
    material: '100% polyester wicking knit',
    color: 'TBD for this year',
    note: 'EAT-RUN-EAT-RUN-EAT-SLEEP-REPEAT on the front, BMXC logo on the back.',
    image: '/merch/eat-run-sleep.jpg',
    tag: 'Singlet',
  },
];

/** Shirts campers receive or earn rather than buy. */
export const INCLUDED_SHIRTS = [
  {
    title: 'Camper t-shirt',
    body: 'Every camper gets a free limited edition camper t-shirt.',
  },
  {
    title: 'Camp Champion t-shirt',
    body: 'The coveted Camp Champion t-shirts can be won by participating in camp challenges.',
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
