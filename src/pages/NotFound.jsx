import PageHeader from '../components/layout/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Reveal from '../components/motion/Reveal.jsx';

export default function NotFound() {
  return (
    <>
      <PageHeader
        eyebrow="Error 404"
        title="You've run off the course"
        lead="That page doesn't exist. Head back to the start and pick up the trail again."
      />
      <section className="section container">
        <Reveal>
          <Button to="/" variant="primary" size="lg">Back to home</Button>
        </Reveal>
      </section>
    </>
  );
}
