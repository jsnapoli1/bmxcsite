// Fill these in and they render automatically; anything left blank is hidden
// rather than shipped as a placeholder.
// Example: { email: 'info@example.com', phone: '(555) 555-5555' }
const contact = {};

export default function About() {
  const hasContact = Object.values(contact).some(Boolean);

  return (
    <div>
      <h1>About</h1>
      <p>
        Founded in 1969, Blue Mountain Cross Country Camp is the oldest and longest running XC
        summer camp in the Northeast. We&apos;re a sleepover running camp for students entering
        grades 7&ndash;12, dedicated to fostering a love for running and providing an environment
        in which student athletes are healthy and successful.
      </p>
      <p>
        Individuals and teams come from all over New York, Pennsylvania, and New Jersey to kick off
        their season and develop friendships that span beyond their running years in high school.
      </p>

      <h2>Get in Touch</h2>
      {hasContact ? (
        <ul>
          {contact.email && (
            <li>
              Email: <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
          )}
          {contact.phone && (
            <li>
              Phone: <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
            </li>
          )}
          {contact.address && <li>{contact.address}</li>}
        </ul>
      ) : (
        <p className="empty-state">Contact details coming soon.</p>
      )}
    </div>
  );
}
