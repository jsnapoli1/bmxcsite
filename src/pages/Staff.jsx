import PageHeader from '../components/layout/PageHeader.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { STAFF_GROUPS, STAFF_CREDENTIALS, GUEST_SPEAKERS } from '../data/staff.js';
import './staff.css';

/** Builds initials for the avatar tile — no photos needed. */
function initialsOf(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export default function Staff() {
  return (
    <>
      <PageHeader
        eyebrow="Our staff"
        title="The Staff"
        lead="Many of our staff have been coming back to BMXC for decades. Some have been with us since the 1980s and 1990s."
      />

      <section className="section container" aria-labelledby="staff-heading">
        <h2 className="sr-only" id="staff-heading">Camp staff</h2>

        {STAFF_GROUPS.map((group, groupIndex) => (
          <div className="staff-group" key={group.group}>
            <Reveal variant="fade" className="staff-group__label">
              <h3>{group.group}</h3>
              <span className="staff-group__count">
                {String(group.members.length).padStart(2, '0')}
              </span>
            </Reveal>

            <ul className="staff-grid">
              {group.members.map((member, index) => (
                <Reveal as="li" key={member.name} delay={Math.min(index, 5) * 45} className="staff-card">
                  <span className="staff-card__avatar" aria-hidden="true">
                    {initialsOf(member.name)}
                  </span>
                  <div className="staff-card__body">
                    <h4 className="staff-card__name">{member.name}</h4>
                    <p className="staff-card__role">
                      {member.role}
                      {member.since ? <span className="staff-card__since"> · since {member.since}</span> : null}
                    </p>
                    <p className="staff-card__bio">{member.bio}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* --- Credentials --- */}
      <section className="section staff-credentials" aria-labelledby="credentials-heading">
        <div className="container">
          <SectionHeading
            eyebrow="Every week"
            title="Also on staff"
            tone="light"
            as="h2"
          />
          <ul className="credentials__list">
            {STAFF_CREDENTIALS.map((credential, index) => (
              <Reveal as="li" key={credential} delay={Math.min(index, 5) * 45} className="credentials__item">
                <span className="credentials__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {credential}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* --- Guest speakers --- */}
      <section className="section container" aria-labelledby="speakers-heading">
        <SectionHeading
          eyebrow="Guest speakers"
          title="Guest Speakers"
          lead="We bring the best athletes, coaches, and educators to spend time with the campers. Some are former BMXC campers who went on to run professionally."
          as="h2"
        />

        <ul className="speakers">
          {GUEST_SPEAKERS.map((speaker, index) => (
            <Reveal as="li" key={speaker.name + index} delay={Math.min(index, 5) * 35} className="speaker">
              <span className="speaker__year">{speaker.year ?? '—'}</span>
              <div className="speaker__body">
                <h3 className="speaker__name">{speaker.name}</h3>
                <p className="speaker__credential">{speaker.credential}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>
    </>
  );
}
