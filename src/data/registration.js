/** Registration details sourced from bluemountainxccamp.com/registration.html */

export const BASE_PRICE = 655;

export const PRICE_TIERS = [
  { name: 'Early Bird', window: 'Jan 1 – Feb 28', discount: 100, price: BASE_PRICE - 100, highlight: true },
  { name: 'Full Rate', window: 'Mar 1 – Apr 30', discount: 55, price: BASE_PRICE - 55, highlight: false },
  { name: 'Late Rate', window: 'May 1 – Jun 30', discount: 0, price: BASE_PRICE, highlight: false },
];

export const BUS_ROUTES = [
  { region: 'New Jersey', stops: 'Rockaway & Woodbridge', price: 100 },
  { region: 'New York', stops: 'Buffalo, Rochester & Syracuse', price: 125 },
];

export const DEPOSIT = 250;

export const PAYMENT_NOTES = [
  'The $250 deposit is non-refundable and guarantees your spot at BMXC.',
  'Register before May 31 and the deposit plus bus fees are due at registration; the balance is billed at the end of May.',
  'Register on June 1 or later and the full balance is due at registration.',
  'Pay by card or by check — you cannot mix payment methods once you have chosen.',
  '$50 off for the 2nd sibling, and for each sibling after that.',
  'We offer everyone — teams and individuals — the same low price regardless of team status.',
];

export const FINE_PRINT = [
  'Cancellations before the end of June: all money refunded except the non-refundable $250 deposit.',
  'Cancellations on 7/1 or later: no money will be refunded.',
  'Bus cancellations on July 1 or later: no refunds.',
  'No transfers between campers.',
  'No discounts, refunds, or partial refunds for arriving late or leaving early.',
];

export const KEY_DATES = [
  { date: 'January 1, 12:01am', label: 'Registration opens' },
  { date: 'Early April', label: 'Buses usually 80% full' },
  { date: 'Early May', label: 'Camp usually 80% full' },
  { date: 'End of June', label: 'Registration closes' },
  { date: 'August 16–22, 2026', label: 'Camp week' },
];
