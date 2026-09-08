import { Link } from 'react-router-dom';
import { Editable } from 'vedit';
import PageHeader from '../components/layout/PageHeader.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { useContent } from '../hooks/useContent.js';
import { STAFF_GROUPS, STAFF_CREDENTIALS, GUEST_SPEAKERS } from '../data/staff.js';
import './staff.css';

/**
 * The roster: name and title, grouped, each name opening that person's page.
 *
 * Shaped after how NCAA programmes present a coaching staff — Oregon,
 * Colorado, NC State and Washington all list staff as a grouped table with
 * headshots kept for the detail page, not the list. That happens to be the
 * same answer this site's own design direction gives: ruled entries rather
 * than a grid of floating cards.
 */
export default function Staff() {
  const { content } = useContent('staff', {
    groups: STAFF_GROUPS,
    speakers: GUEST_SPEAKERS,
    credentials: STAFF_CREDENTIALS,
  });

  // Both were static until the roster redesign, so a published document that
  // predates them has neither key. Falling back keeps the sections rendering
  // rather than blanking them on the first deploy.
  const speakers = content.speakers ?? GUEST_SPEAKERS;
  const credentials = content.credentials ?? STAFF_CREDENTIALS;

  return (
    <>
      <PageHeader
        id="staff.header"
        eyebrow="Our staff"
        title="The Staff"
        lead="Many of our staff have been coming back to BMXC for decades. Some have been with us since the 1980s and 1990s."
      />

      <section className="section container" aria-labelledby="staff-heading">
        <h2 className="sr-only" id="staff-heading">
          <Editable id="staff.sr.heading" as="span">Camp staff</Editable>
        </h2>

        {content.groups.map((group) => (
          // Keyed on the group's name: it is the only handle a group has.
          // The members below carry a persisted slug, but a group is a title
          // and a sort order in D1 and nothing more, so renaming one orphans
          // its override — the same trade the member ids were added to avoid,
          // and worth fixing if groups ever gain an id column.
          <div className="staff-group" key={group.group}>
            <Reveal variant="fade" className="staff-group__label">
              <Editable id={`staff.group.${group.group}`} as="h3">
                {group.group}
              </Editable>
              <span className="staff-group__count">
                {String(group.members.length).padStart(2, '0')}
              </span>
            </Reveal>

            <table className="staff-table">
              <thead>
                <tr>
                  <th scope="col">
                    <Editable id="staff.table.name" as="span">Name</Editable>
                  </th>
                  <th scope="col">
                    <Editable id="staff.table.title" as="span">Title</Editable>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.members.map((member) => (
                  <tr key={member.slug ?? member.name}>
                    {/* data-label drives the stacked layout below the table's
                        breakpoint — the same contract .admin-table uses. */}
                    <td data-label="Name" className="staff-table__name">
                      {member.slug ? (
                        <Link to={`/staff/${member.slug}`}>{member.name}</Link>
                      ) : (
                        member.name
                      )}
                    </td>
                    <td data-label="Title">{member.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {/* --- Credentials --- */}
      <section className="section staff-credentials" aria-labelledby="credentials-heading">
        <div className="container">
          <SectionHeading
            id="staff.also"
            headingId="credentials-heading"
            eyebrow="Every week"
            title="Also on staff"
            tone="light"
            as="h2"
          />
          <ul className="credentials__list">
            {credentials.map((credential, index) => (
              <Reveal as="li" key={credential.id} delay={Math.min(index, 5) * 45} className="credentials__item">
                <span className="credentials__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Editable
                  id={`staff.credential.${credential.id}`}
                  label={credential.text}
                  as="span"
                >
                  {credential.text}
                </Editable>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* --- Guest speakers --- */}
      <section className="section container" aria-labelledby="speakers-heading">
        <SectionHeading
          id="staff.speakers"
          headingId="speakers-heading"
          eyebrow="Guest speakers"
          title="Guest Speakers"
          lead="We bring the best athletes, coaches, and educators to spend time with the campers. Some are former BMXC campers who went on to run professionally."
          as="h2"
        />

        <ul className="speakers">
          {speakers.map((speaker, index) => (
            <Reveal as="li" key={speaker.id ?? speaker.name} delay={Math.min(index, 5) * 35} className="speaker">
              {/* The em-dash fallback is authored; the year is data. */}
              <Editable
                id={`staff.speaker.${speaker.id ?? speaker.name}.year`}
                label={`${speaker.name} — year`}
                as="span"
                className="speaker__year"
                vars={{ year: String(speaker.year ?? '—') }}
              >
                {'{year}'}
              </Editable>
              <div className="speaker__body">
                <Editable
                  id={`staff.speaker.${speaker.id ?? speaker.name}.name`}
                  as="h3"
                  className="speaker__name"
                >
                  {speaker.name}
                </Editable>
                <Editable
                  id={`staff.speaker.${speaker.id ?? speaker.name}.credential`}
                  as="p"
                  className="speaker__credential"
                >
                  {speaker.credential}
                </Editable>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>
    </>
  );
}
