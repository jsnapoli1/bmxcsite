import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { FAQ_CATEGORIES, MAIL_ADDRESSES } from '../data/faq.js';
import './faq.css';

export default function Faq() {
  const [activeCategory, setActiveCategory] = useState(FAQ_CATEGORIES[0].id);
  const [openQuestion, setOpenQuestion] = useState(null);

  const category =
    FAQ_CATEGORIES.find((entry) => entry.id === activeCategory) ?? FAQ_CATEGORIES[0];

  const selectCategory = (id) => {
    setActiveCategory(id);
    setOpenQuestion(null);
  };

  return (
    <>
      <PageHeader
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
              {FAQ_CATEGORIES.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`faq__rail-btn${entry.id === activeCategory ? ' is-active' : ''}`}
                    onClick={() => selectCategory(entry.id)}
                    aria-current={entry.id === activeCategory}
                  >
                    <span className="faq__rail-label">{entry.label}</span>
                    <span className="faq__rail-count">{entry.items.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* --- Questions --- */}
          <div className="faq__panel">
            <ul className="faq__list">
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
