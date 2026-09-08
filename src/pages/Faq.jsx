import { useState } from 'react';
import { Editable } from 'vedit';
import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { useContent } from '../hooks/useContent.js';
import { FAQ_CATEGORIES, MAIL_ADDRESSES } from '../data/faq.js';
import { withQuestionIds } from '../lib/faq-ids.js';
import './faq.css';

export default function Faq() {
  const { content } = useContent('faq', { categories: FAQ_CATEGORIES });
  // Documents written before questions had ids still need stable handles,
  // and a document is only rewritten when someone saves in /admin. Filling
  // them in on read means an unmigrated FAQ is editable too.
  const categories = withQuestionIds(content.categories);

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
          <h2 className="sr-only" id="faq-heading">
            <Editable id="faq.sr.heading" as="span">Frequently asked questions</Editable>
          </h2>
          <Editable id="faq.empty" as="p">Nothing to show yet. Check back soon.</Editable>
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
        <h2 className="sr-only" id="faq-heading">
          <Editable id="faq.sr.heading" as="span">Frequently asked questions</Editable>
        </h2>

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
              {/* Keyed on the question's own id, minted once when it is
                  created and carried in the content document. Position
                  (`${category.id}-${index}`) was the reason these could not
                  be wrapped: /admin offers an explicit reorder control, so
                  moving a question would slide the one below it into its
                  override.

                  The answers remain the camp's own sentences and /admin is
                  still the right place to rewrite them; the editor is for
                  when the presentation is what needs changing. */}
              {category.items.map((item, index) => {
                const key = `${category.id}-${item.id ?? index}`;
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
                        <Editable
                          id={`faq.item.${item.id}.q`}
                          label={item.q}
                          as="span"
                        >
                          {item.q}
                        </Editable>
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
                      <Editable
                        id={`faq.item.${item.id}.a`}
                        label={`${item.q} — answer`}
                        as="p"
                      >
                        {item.a}
                      </Editable>
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
