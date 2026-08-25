import { useState } from 'react';
import { Editable } from 'vedit';
import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { useContent } from '../hooks/useContent.js';
import { FAQ_CATEGORIES, MAIL_ADDRESSES } from '../data/faq.js';
import './faq.css';

export default function Faq() {
  const { content } = useContent('faq', { categories: FAQ_CATEGORIES });
  const categories = content.categories;

  const [activeCategory, setActiveCategory] = useState(FAQ_CATEGORIES[0].id);
  const [openQuestion, setOpenQuestion] = useState(null);

  const category =
    categories.find((entry) => entry.id === activeCategory) ?? categories[0];

  // Defense in depth: useContent's isEmpty gate should already keep this
  // page on the bundled fallback whenever the API has nothing to show, so
  // `categories` should never be empty here. But this is the page that
  // white-screened when that guard didn't exist yet, so guard here too
  // rather than trust a single upstream check for the one page where the
  // failure mode is a blank screen instead of stale content.
  if (!category) {
    return (
      <>
        <PageHeader
          id="faq.header"
          eyebrow="Common questions"
          title="Frequently Asked Questions"
          lead="If your question is not answered here, email Camp Directors Ken and Sarah."
        />
        <section className="section container faq" aria-labelledby="faq-heading">
          <h2 className="sr-only" id="faq-heading">Frequently asked questions</h2>
          <p>Nothing to show yet. Check back soon.</p>
        </section>
      </>
    );
  }

  const selectCategory = (id) => {
    setActiveCategory(id);
    setOpenQuestion(null);
  };

  return (
    <>
      <PageHeader
        id="faq.header"
        eyebrow="Common questions"
        title="Frequently Asked Questions"
        lead="If your question is not answered here, email Camp Directors Ken and Sarah."
      />

      <section className="section container faq" aria-labelledby="faq-heading">
        <h2 className="sr-only" id="faq-heading">Frequently asked questions</h2>

        <div className="faq__layout">
          {/* --- Category rail --- */}
          <nav className="faq__rail" aria-label="FAQ categories">
            <ul className="faq__rail-list">
              {categories.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`faq__rail-btn${entry.id === activeCategory ? ' is-active' : ''}`}
                    onClick={() => selectCategory(entry.id)}
                    aria-current={entry.id === activeCategory}
                  >
                    <Editable
                      id={`faq.category.${entry.id}.label`}
                      as="span"
                      className="faq__rail-label"
                    >
                      {entry.label}
                    </Editable>
                    <span className="faq__rail-count">{entry.items.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* --- Questions --- */}
          <div className="faq__panel">
            <ul className="faq__list">
              {/* The questions themselves are deliberately NOT wrapped in
                  <Editable>. A FAQ item's only handle is its position
                  (`${category.id}-${index}`), so an explicit id built from
                  it would look stable while silently reattaching an
                  override to a different question the moment someone
                  reorders or inserts one in /admin — worse than the
                  scanner's ids, which at least advertise their fragility.

                  These answers are also the camp's own sentences (see
                  CLAUDE.md); /admin is where they should be edited. */}
              {category.items.map((item, index) => {
                const key = `${category.id}-${index}`;
                const isOpen = openQuestion === key;

                return (
                  <Reveal as="li" key={key} delay={Math.min(index, 5) * 30} className="faq__item">
                    <h3>
                      <button
                        type="button"
                        className={`faq__question${isOpen ? ' is-open' : ''}`}
                        onClick={() => setOpenQuestion(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        aria-controls={`answer-${key}`}
                        id={`question-${key}`}
                      >
                        <span>{item.q}</span>
                        <span className="faq__icon" aria-hidden="true" />
                      </button>
                    </h3>
                    <div
                      className={`faq__answer${isOpen ? ' is-open' : ''}`}
                      id={`answer-${key}`}
                      role="region"
                      aria-labelledby={`question-${key}`}
                      hidden={!isOpen}
                    >
                      <p>{item.a}</p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>

            {/* Mail addresses are easier to read as blocks than as Q&A. */}
            {category.id === 'mail' ? (
              <Reveal delay={120} className="faq__addresses">
                <h3 className="faq__addresses-title">Where to send camper mail</h3>
                <div className="faq__addresses-grid">
                  {MAIL_ADDRESSES.map((address) => (
                    <div className="faq__address" key={address.label}>
                      <span className="faq__address-label">{address.label}</span>
                      <address>
                        {address.lines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </address>
                    </div>
                  ))}
                </div>
              </Reveal>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
