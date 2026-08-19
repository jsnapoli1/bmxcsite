/**
 * Camp facts sourced from bluemountainxccamp.com.
 * Kept in one place so copy edits never require touching components.
 */

export const CAMP = {
  name: 'Blue Mountain Cross Country Camp',
  shortName: 'BMXC',
  founded: 1969,
  tagline: '50+ years of great training, creating friends, strengthening teams, and tradition',
  intro:
    "Founded in 1969, Blue Mountain Cross Country Camp is the oldest and longest running XC summer camp in the Northeast! We're a sleepover running camp for students entering grades 7-12 and are dedicated to fostering a love for running and providing an environment in which student athletes are healthy and successful.",
  reach:
    'Individuals and teams come from all over New York, Pennsylvania, & New Jersey to kick off their season and develop friendships that span beyond their running years in high school.',
  session: { year: 2026, start: 'Sunday, August 16', end: 'Saturday, August 22' },
  venue: {
    name: 'Camp Westmont',
    region: 'Pocono Mountains, Pennsylvania',
    town: 'Poyntelle, PA',
    accreditation: 'ACA-accredited',
  },
  contact: {
    email: 'directors@bluemountainxccamp.com',
    phone: '585-694-5069',
    directors: 'Ken and Sarah',
    mailing: { line1: 'BMXC', line2: '207 Richmond Ave', line3: 'Buffalo, NY 14222' },
  },
  social: {
    facebook: 'https://facebook.com/BlueMountainCrossCountryCamp/',
    instagram: 'https://instagram.com/bluemountainxc',
  },
};

/** Headline numbers for the hero stat strip. */
export const STATS = [
  { value: '1969', label: 'Founded', detail: 'Oldest XC camp in the Northeast' },
  { value: '300', label: 'Campers', detail: 'Every summer' },
  { value: '70', label: 'Teams', detail: 'Represented each year' },
  { value: '7-12', label: 'Grades', detail: 'Entering grades welcome' },
];

/** What makes the week different — used on the Home page feature grid. */
export const PILLARS = [
  {
    title: 'Grouped by ability, not by age',
    body: 'We collect your training data right before camp so we have an accurate view of your fitness, then build running groups from it. Every group runs with an assigned coach, and road support cars are out on the route.',
    tag: 'Training',
  },
  {
    title: 'Miles of Pocono terrain',
    body: 'Winding dirt roads, sprawling grass fields, smooth paved roads, and a long cinder path. No track, no measured intervals — just honest running on real ground.',
    tag: 'Terrain',
  },
  {
    title: 'Coaches with decades in the sport',
    body: 'Hall of Fame high school coaches, current and former Division 1, 2 and 3 athletes, a registered nurse, and Red Cross certified lifeguards.',
    tag: 'Staff',
  },
  {
    title: 'The people you keep',
    body: 'About half the camp arrives as teams of 7+, the other half in small groups or alone. Nobody stays a stranger — the friendships tend to outlast the seasons.',
    tag: 'Community',
  },
];

/** Full-day example schedule. */
export const SCHEDULE = [
  { time: '7:30am', title: 'Breakfast', body: 'Every full day at camp starts with a great breakfast, prepared by our chef and kitchen staff.' },
  { time: '9:30am', title: 'Morning run', body: 'Groups assemble by ability, complete an active warm-up routine, then head out onto the hills, roads, and trails.' },
  { time: '12:00pm', title: 'Lunch', body: 'Indoors with air conditioning, or outdoors as part of a cookout.' },
  { time: '2:00pm', title: 'Optional session', body: 'Educational programming — goal-setting, mental race preparation. Attending earns an entry into the prize drawings.' },
  { time: '3:00pm', title: 'Afternoon run', body: 'Some groups run while others do strength and recovery work, sometimes built around a challenge or a game.' },
  { time: '6:00pm', title: 'Dinner', body: 'A full meal accommodating every dietary restriction and nutritional need.' },
  { time: '8:00pm', title: 'Evening meeting', body: 'Sometimes a talent show, sometimes a guest speaker, sometimes a campwide activity. The snack window often opens afterward.' },
  { time: 'Evening', title: 'Optional social', body: 'A dance with a DJ, a campfire with s’mores, or tie-dye shirt making.' },
  { time: '10:15pm', title: 'Report to cabins', body: 'Back to the cabin for the night.' },
  { time: '11:00pm', title: 'Lights out', body: 'Sleep is training too — recovery matters as much as the miles.' },
];
