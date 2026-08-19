/**
 * YouTube channel + videos, pulled from youtube.com/@bluemountainxccamp9143.
 *
 * TO ADD A VIDEO: paste any YouTube URL (watch, youtu.be, or embed) into
 * `url` — the id is parsed automatically. `year` drives the filter chips,
 * and `featured: true` pins a video to the stage on page load.
 */
export const CHANNEL = {
  name: 'Blue Mountain XC Camp',
  handle: '@bluemountainxccamp9143',
  channelId: 'UCmcwPVLf76R1GVRxOsIiaeA',
  url: 'https://youtube.com/@bluemountainxccamp9143',
  description:
    'Week recaps, day-by-day diaries, and skit footage going all the way back to 2007.',
};

export const VIDEOS = [
  { id: 'jpKxRrEcYvs', year: '2023', title: 'BMXC 23 — Full Week Recap', description: 'The whole week on the mountain, start to finish.', url: 'https://youtu.be/jpKxRrEcYvs', featured: true },
  { id: 'wczyPteK9No', year: '2023', title: 'BMXC 23 — Day 1, Sunday', description: 'Arrival day: buses roll in and cabins fill up.', url: 'https://youtu.be/wczyPteK9No' },
  { id: 'W0OvRXMsQ4g', year: '2023', title: 'BMXC 23 — Day 2, Monday', description: 'First full day of running groups on the dirt roads.', url: 'https://youtu.be/W0OvRXMsQ4g' },
  { id: 'zw2HXti6HPo', year: '2023', title: 'BMXC 23 — Days 3 & 4', description: 'Tuesday and Wednesday, deep into the week.', url: 'https://youtu.be/zw2HXti6HPo' },
  { id: 'c5iu-KnjHVs', year: '2022', title: 'BMXC Recap 2022', description: 'The 2022 session, condensed.', url: 'https://youtu.be/c5iu-KnjHVs' },
  { id: '0rvUMdFCAb4', year: '2019', title: 'BMXC Recap 2019', description: 'Highlights from the 2019 week.', url: 'https://youtu.be/0rvUMdFCAb4' },
  { id: 'h6bNlSFMgXo', year: '2019', title: 'BMXC 2019', description: 'Camp week 2019 on the mountain.', url: 'https://youtu.be/h6bNlSFMgXo' },
  { id: 'J982jQr-jeg', year: '2019', title: 'BMXC Instagram 2019', description: 'The short cut, made for the feed.', url: 'https://youtu.be/J982jQr-jeg' },
  { id: 'dxxw9k-rSzs', year: '2017', title: '2017 BMXC Camp Highlights', description: 'A look back at the 2017 session.', url: 'https://youtu.be/dxxw9k-rSzs' },
  { id: 'iHdoTGASSC0', year: '2016', title: '2016 BMXC Camp Highlights', description: 'A look back at the 2016 session.', url: 'https://youtu.be/iHdoTGASSC0' },
  { id: 'vnDmAwZliGA', year: '2007', title: '2007 Camp Recap — Part 1', description: 'From the archives: the first of a three-part recap.', url: 'https://youtu.be/vnDmAwZliGA' },
  { id: 'aigD3CnKBB4', year: '2007', title: '2007 Camp Recap — Part 2', description: 'From the archives: part two of three.', url: 'https://youtu.be/aigD3CnKBB4' },
  { id: 'RUk9hwiVYp0', year: '2007', title: '2007 Camp Recap — Part 3', description: 'From the archives: the final part.', url: 'https://youtu.be/RUk9hwiVYp0' },
  { id: 'it0PtcmCjtE', year: '2007', title: '2007 Camp Stomp Skit', description: 'Evening meeting, talent show era.', url: 'https://youtu.be/it0PtcmCjtE' },
  { id: 'bFJpygBURBc', year: '2007', title: '2007 Cup Stacking Time Lapse', description: 'A camp skit, sped all the way up.', url: 'https://youtu.be/bFJpygBURBc' },
];

/** Distinct years, newest first — drives the filter chips. */
export const VIDEO_YEARS = [...new Set(VIDEOS.map((video) => video.year))].sort((a, b) => b - a);

/** Pulls the video id out of any standard YouTube URL (watch, youtu.be, embed, shorts). */
export function getYouTubeId(video) {
  if (video.videoId) return video.videoId;
  if (!video.url) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = video.url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
