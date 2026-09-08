/**
 * Staff roster sourced from bluemountainxccamp.com/staff.html
 *
 * Shape follows how NCAA programmes present a coaching staff: the roster is
 * name and title only, and the detail belongs on the person's own page.
 *
 * Every field except `name` is optional — a member with nothing but a name
 * still renders, and `validateStaff` requires nothing more.
 *
 * `slug` is the stable handle. It is the person's /staff/<slug> URL and the
 * key vedit stores an override against, so it must not change when a name is
 * corrected. Generated once for a new member and then left alone.
 *
 * `accolades` are counted, scannable lines rather than prose — the pattern
 * Arkansas uses on its own staff pages, and the one that suits a coach whose
 * credential is the athletes they have developed. Each carries an id for the
 * same reason every other list on this site does: an id built from the text
 * reattaches to a different line the moment someone rewords one.
 *
 * `since` is a year, and the page renders it as prose ("In his 20th summer"),
 * because no NCAA programme labels it and a bare year reads like a footnote.
 */

export const STAFF_GROUPS = [
  {
    id: 'camp-directors',
    group: 'Camp Directors',
    members: [
      {
        slug: 'ken-crawford',
        name: 'Ken Crawford',
        role: 'Camp Director',
        education: 'Clarkson University, 2006',
        bio: 'Competitive runner for 25+ years and a chemical engineer.',
        accolades: [
          { id: 'competitive-25-years', text: 'Competitive runner for more than 25 years' },
        ],
      },
      {
        slug: 'sarah-schnitter',
        name: 'Sarah Schnitter',
        role: 'Camp Director',
        education: 'Nazareth College',
        bio: 'First-grade teacher and assistant cross country and track coach.',
        accolades: [],
      },
    ],
  },
  {
    id: 'assistants-to-the-directors',
    group: 'Assistants to the Directors',
    members: [
      {
        slug: 'paul-buccino',
        name: 'Paul Buccino',
        role: 'Assistant to the Directors',
        since: 1994,
        bio: 'Long-serving high school coach in New Jersey.',
        accolades: [
          { id: 'njsca-hall-of-fame', text: 'NJSCA Hall of Fame member' },
          { id: 'morristown-29-seasons', text: '29 cross country seasons at Morristown High School, New Jersey' },
        ],
      },
      {
        slug: 'matthew-hellerer',
        name: 'Matthew Hellerer',
        role: 'Assistant to the Directors',
        since: 1987,
        bio: 'High school science teacher and long-serving coach.',
        accolades: [
          { id: 'wny-running-hall-of-fame', text: 'Western NY Running Hall of Fame member' },
          { id: 'sjci-23-seasons', text: '23 cross country seasons at SJCI' },
        ],
      },
    ],
  },
  {
    id: 'veteran-coaches',
    group: 'Veteran Coaches',
    members: [
      {
        slug: 'william-buckenmeyer',
        name: 'William Buckenmeyer',
        role: 'Veteran Coach',
        since: 2006,
        bio: 'Coach across multiple New York high schools.',
        accolades: [
          { id: 'twelve-seasons-ny', text: '12 cross country seasons coached across New York high schools' },
        ],
      },
      {
        slug: 'patricia-mulligan',
        name: 'Patricia Mulligan',
        role: 'Veteran Coach',
        since: 2008,
        bio: 'Long-serving coach in New York.',
        accolades: [
          { id: 'abel-kiviat-award', text: 'Recipient of the Abel Kiviat Service Award' },
          { id: 'msit-22-seasons', text: '22 cross country seasons at MSIT, New York' },
        ],
      },
      {
        slug: 'chris-mekelburg',
        name: 'Chris Mekelburg',
        role: 'Veteran Coach',
        since: 2011,
        bio: 'Coaches cross country, indoor and outdoor track.',
        accolades: [
          { id: 'sjci-26-seasons', text: '26 seasons coaching cross country, indoor and outdoor track at SJCI' },
        ],
      },
      {
        slug: 'john-schnitter',
        name: 'John Schnitter',
        role: 'Veteran Coach',
        since: 2010,
        bio: 'Coach at Wayland-Cohocton High School, New York.',
        accolades: [
          { id: 'wayland-cohocton', text: 'Three years coaching at Wayland-Cohocton High School, New York' },
        ],
      },
    ],
  },
  {
    id: 'medical-support',
    group: 'Medical & Support',
    members: [
      {
        slug: 'madeline-rogowski',
        name: 'Madeline Rogowski',
        role: 'Camp Nurse',
        since: 2021,
        bio: 'Camp nurse.',
        accolades: [],
      },
      {
        slug: 'maura-seitz',
        name: 'Maura Seitz',
        role: 'Registered Nurse',
        since: 2016,
        bio: 'Registered nurse.',
        accolades: [],
      },
    ],
  },
];

export const STAFF_CREDENTIALS = [
  { id: 'registered-nurse-site', text: 'A registered nurse on site' },
  { id: 'american-red-cross-certified', text: 'American Red Cross certified lifeguards' },
  { id: 'high-school-coaches-cpr', text: 'High school coaches with CPR, AED, and First Aid training' },
  { id: 'current-former-college-athletes', text: 'Current and former college athletes from Division 1, 2, and 3 schools' },
  { id: 'running-store-employees-know', text: 'Running store employees who know the gear' },
];

/** A selection of past guest speakers. */
export const GUEST_SPEAKERS = [
  { id: 'sam-ellis', year: 2025, name: 'Sam Ellis', credential: 'Professional 800m/1500m runner. Four-time Ivy League champion at Princeton, All-American, and Pac-12 800m title winner. Signed with On in 2023.' },
  { id: 'molly-huddle', year: 2024, name: 'Molly Huddle', credential: 'Two-time Olympian, multiple American record holder, and 28-time USA champion across track and road.' },
  { id: 'sara-slattery', year: 2024, name: 'Sara Slattery', credential: 'Two-time NCAA champion and experienced college coach.' },
  { id: 'dr-craig-cypher', year: 2023, name: 'Dr. Craig Cypher', credential: 'Clinical and sport psychologist, Assistant Professor of Clinical Orthopaedics at the University of Rochester Medical Center.' },
  { id: 'steve-magness', year: 2022, name: 'Steve Magness', credential: 'Author of The Science of Running and Do Hard Things; co-author of Peak Performance.' },
  { id: 'dathan-ritzenhein', year: 2019, name: 'Dathan Ritzenhein', credential: 'Three-time Olympian, NCAA cross country individual champion, and former American 5K record holder at 12:56.27.' },
  { id: 'molly-seidel', year: 2018, name: 'Molly Seidel', credential: 'Olympic marathon bronze medallist and four-time national champion at Notre Dame.' },
  { id: 'jim-ryun', year: null, name: 'Jim Ryun', credential: 'First US high schooler to break the four-minute mile, world record holder, and 1968 Olympic silver medallist.' },
  { id: 'carrie-tollefson', year: null, name: 'Carrie Tollefson', credential: '2004 Athens Olympian, NCAA cross country champion, and USA 1500m champion.' },
  { id: 'jack-daniels', year: 2014, name: 'Jack Daniels', credential: 'Author of Daniels’ Running Formula. Coached eight NCAA Division III national championship teams at SUNY Cortland.' },
];
