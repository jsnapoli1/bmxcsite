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
 * What tends to be on the table, shown as a carousel on the Merch page.
 *
 * The camp publishes a $15-40 range rather than a per-item price list, so
 * each `price` below is an estimate positioned within that published range —
 * not a quoted figure. `priceNote` makes that explicit in the UI.
 */
export const MERCH_ITEMS = [
  {
    id: 'hoodie',
    name: 'The Blue Hoodie',
    note: 'Our most iconic item, and the one campers come back for. Heavyweight, camp-blue, and it sells out every single year.',
    price: '$40',
    priceNote: 'Top of the range',
    tag: 'Most iconic',
    hero: true,
  },
  {
    id: 'tee',
    name: 'Camp Tee',
    note: 'The classic. A different design every summer, so returning campers end up with a stack of them.',
    price: '$20',
    priceNote: 'Typical',
    tag: 'Bestseller',
  },
  {
    id: 'longsleeve',
    name: 'Long Sleeve Tee',
    note: 'For the chilly mountain mornings — average temps start around 50°F before the sun gets up.',
    price: '$25',
    priceNote: 'Typical',
    tag: 'Apparel',
  },
  {
    id: 'shorts',
    name: 'Running Shorts',
    note: 'Styles and sizes vary year to year. Quantities are always limited.',
    price: '$30',
    priceNote: 'Typical',
    tag: 'Apparel',
  },
  {
    id: 'hat',
    name: 'Camp Hat',
    note: 'Useful on the sunny afternoons, and one of the easier things to still find later in the week.',
    price: '$20',
    priceNote: 'Typical',
    tag: 'Accessory',
  },
  {
    id: 'extras',
    name: 'Stickers & Extras',
    note: 'Stickers, accessories, and the occasional one-off. The cheapest way to take something home.',
    price: '$15',
    priceNote: 'Entry price',
    tag: 'Accessory',
  },
];

/** Prizes are given away, not sold — worth distinguishing on this page. */
export const GIVEAWAYS = {
  body: 'We run hundreds of giveaways during the week — BMXC merch, custom one-of-a-kind BMXC blankets, and specialty running gear. Every time a camper attends an optional info-session, they earn one entry into the prize drawing.',
};
