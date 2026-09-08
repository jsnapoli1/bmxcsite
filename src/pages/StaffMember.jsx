import { Link, useParams } from 'react-router-dom';
import { Editable, EditableImage } from 'vedit';
import Reveal from '../components/motion/Reveal.jsx';
import { useContent } from '../hooks/useContent.js';
import { STAFF_GROUPS } from '../data/staff.js';
import './staff.css';

/** Initials, for a member with no headshot. The roster's own fallback. */
function initialsOf(name) {
  return String(name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

/**
 * Tenure as a sentence, the way every NCAA programme writes it — "in his
 * ninth season at Oregon" — rather than a `Since: 2006` label. None of the
 * programmes surveyed uses a label, and a bare year reads like a footnote.
 *
 * Ordinal rather than a count of years, because a coach who started in 2006
 * is in their 20th summer in 2025, not their 19th.
 */
export function tenureSentence(since, year = new Date().getUTCFullYear()) {
  // Number('') and Number(null) are both 0, which is finite and would render
  // "In their 2027th summer" — and empty is exactly what the admin's text
  // input yields for a member with no start year. Reject anything that is
  // not a plausible four-digit year rather than trusting the coercion.
  const start = Number(since);
  const plausible = Number.isInteger(start) && start >= 1900 && start <= year;
  if (!plausible) return null;
  const nth = year - start + 1;
  const suffix = (n) => {
    if (n % 100 >= 11 && n % 100 <= 13) return 'th';
    return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  };
  return `In their ${nth}${suffix(nth)} summer at Blue Mountain.`;
}

export default function StaffMember() {
  const { slug } = useParams();
  const { content } = useContent('staff', { groups: STAFF_GROUPS });

  const found = content.groups
    .flatMap((group) => (group.members ?? []).map((member) => ({ member, group })))
    .find((entry) => entry.member.slug === slug);

  if (!found) {
    return (
      <main className="section container staff-member">
        <h1 className="staff-member__name">Not on the staff list</h1>
        <p className="staff-member__lead">
          We could not find that person. They may have left the staff, or the
          link may be out of date.
        </p>
        <p><Link to="/staff">Back to the staff list</Link></p>
      </main>
    );
  }

  const { member, group } = found;
  const tenure = tenureSentence(member.since);
  const accolades = member.accolades ?? [];

  return (
    <main className="section container staff-member">
      <p className="staff-member__back">
        <Link to="/staff">
          <Editable id="staff.member.back" as="span">Back to the staff list</Editable>
        </Link>
      </p>

      <div className="staff-member__head">
        <Reveal variant="fade" className="staff-member__portrait">
          {member.photo?.key ? (
            /* 2:3 portrait, top-anchored — the ratio and crop every roster
               page surveyed uses, so a head is never cut off. */
            <EditableImage
              id={`staff.member.${member.slug}.photo`}
              as="img"
              src={`/media/${member.photo.key}`}
              alt={member.photo.alt || member.name}
              width="360"
              height="540"
              loading="eager"
            />
          ) : (
            <span className="staff-member__initials" aria-hidden="true">
              {initialsOf(member.name)}
            </span>
          )}
        </Reveal>

        <div className="staff-member__identity">
          <Editable
            id={`staff.member.${member.slug}.name`}
            as="h1"
            className="staff-member__name"
          >
            {member.name}
          </Editable>

          {member.role && (
            <Editable
              id={`staff.member.${member.slug}.role`}
              as="p"
              className="staff-member__role"
            >
              {member.role}
            </Editable>
          )}

          <dl className="staff-member__facts">
            <div>
              <dt><Editable id="staff.member.facts.group" as="span">Group</Editable></dt>
              <dd>{group.group}</dd>
            </div>
            {member.education && (
              <div>
                <dt>
                  <Editable id="staff.member.facts.education" as="span">Education</Editable>
                </dt>
                <dd>{member.education}</dd>
              </div>
            )}
            {member.hometown && (
              <div>
                <dt>
                  <Editable id="staff.member.facts.hometown" as="span">Hometown</Editable>
                </dt>
                <dd>{member.hometown}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {tenure && (
        // Not an <Editable>: the sentence is computed from the year, so an
        // override would freeze "20th summer" and be wrong next June.
        <p className="staff-member__tenure">{tenure}</p>
      )}

      {member.bio && (
        <Editable
          id={`staff.member.${member.slug}.bio`}
          as="p"
          className="staff-member__bio"
        >
          {member.bio}
        </Editable>
      )}

      {accolades.length > 0 && (
        <section className="staff-member__accolades" aria-labelledby="accolades-heading">
          <h2 id="accolades-heading" className="staff-member__accolades-title">
            <Editable id="staff.member.accolades.heading" as="span">Career highlights</Editable>
          </h2>
          <ul>
            {accolades.map((accolade) => (
              <li key={accolade.id}>
                <Editable
                  id={`staff.member.${member.slug}.accolade.${accolade.id}`}
                  label={accolade.text}
                  as="span"
                >
                  {accolade.text}
                </Editable>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
