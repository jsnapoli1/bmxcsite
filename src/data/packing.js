/**
 * Packing list sourced from bluemountainxccamp.com/packing-list.html
 *
 * Every category and item carries an explicit `id`. Those ids are what the
 * visual editor keys an override on, so they must stay stable: renaming an
 * item's text is fine and keeps its override, but changing an `id` orphans
 * it, and reusing one moves another item's edit onto this row.
 *
 * Ids rather than the string itself (`key={item}`) because an id built from
 * the text reattaches to a different item the moment someone rewords one —
 * which is exactly what editing this list in the browser is for.
 */

export const PACKING_LIST = [
  {
    id: 'bedding-toiletries',
    category: 'Bedding & toiletries',
    items: [
      { id: 'pillow-pillowcase', text: 'Pillow and pillowcase' },
      { id: 'sleeping-bag-heavy', text: 'Sleeping bag and/or heavy blanket' },
      { id: 'fitted-twin-sheets', text: 'Fitted twin sheets, top and bottom' },
      { id: 'towel-washcloth', text: 'Towel and washcloth' },
      { id: 'toothbrush-toothpaste', text: 'Toothbrush and toothpaste' },
      { id: 'soap-deodorant', text: 'Soap and deodorant' },
      { id: 'shampoo-conditioner', text: 'Shampoo and conditioner' },
      { id: 'contact-lenses-glasses', text: 'Contact lenses or glasses' },
    ],
  },
  {
    id: 'clothing',
    category: 'Clothing',
    items: [
      { id: '7-running-outfits', text: 'At least 7 running outfits — there are 12 sessions' },
      { id: 'socks-plenty-pairs', text: 'Socks, plenty of pairs' },
      { id: 'undergarments-pyjamas', text: 'Undergarments and pyjamas' },
      { id: 'casual-shorts-pants', text: 'Casual shorts, pants and t-shirts' },
      { id: 'sweatshirt-sweatpants', text: 'Sweatshirt and sweatpants' },
      { id: 'swimsuit-second-towel', text: 'Swimsuit and a second towel' },
      { id: 'rain-coat-cap', text: 'Rain coat and a cap or hat' },
      { id: 'school-shirt-team', text: 'School shirt, for team photos' },
    ],
  },
  {
    id: 'footwear',
    category: 'Footwear',
    items: [
      { id: '2-pairs-running', text: '2 pairs of running shoes — 3 is better' },
      { id: 'newspaper-drying-shoes', text: 'Newspaper, for drying shoes out' },
      { id: 'sandals-water-shoes', text: 'Sandals or water shoes for the shower and lake' },
    ],
  },
  {
    id: 'don-t-forget',
    category: 'Don’t forget',
    items: [
      { id: 'medications-ziploc-bag', text: 'Medications, in a ziploc bag' },
      { id: 'reusable-water-bottle', text: 'Reusable water bottle — possibly two' },
      { id: 'watch-charger', text: 'Watch and charger' },
      { id: 'phone-charger', text: 'Phone and charger' },
      { id: 'umbrella-sunscreen-sunglasses', text: 'Umbrella, sunscreen, sunglasses' },
      { id: 'dirty-laundry-bag', text: 'Dirty laundry bag' },
      { id: 'flashlight-bug-spray', text: 'Flashlight and bug spray (optional)' },
    ],
  },
  {
    id: 'nice-have',
    category: 'Nice to have',
    items: [
      { id: 'snacks-resealable-containers', text: 'Snacks in resealable containers' },
      { id: 'frisbee-deck-cards', text: 'A frisbee or a deck of cards' },
      { id: 'running-log', text: 'Running log' },
      { id: 'book', text: 'A book' },
      { id: 'stuffed-animal-no', text: 'Stuffed animal — no judgement' },
    ],
  },
];
