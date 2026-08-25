import PageHeader from '../components/layout/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Reveal from '../components/motion/Reveal.jsx';

export default function NotFound() {
  return (
    <>
      <PageHeader
        id="notfound.header"
        eyebrow="Error 404"
        title="Page not found"
        lead="That page does not exist. Try the home page or the FAQ."
      />
      <section className="section container">
        <Reveal>
          <Button to="/" variant="primary" size="lg">Back to home</Button>
        </Reveal>
      </section>
    </>
  );
}
