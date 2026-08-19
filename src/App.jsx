import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import Home from './pages/Home.jsx';
import Camp from './pages/Camp.jsx';
import Playlists from './pages/Playlists.jsx';
import Videos from './pages/Videos.jsx';
import Staff from './pages/Staff.jsx';
import Faq from './pages/Faq.jsx';
import Registration from './pages/Registration.jsx';
import Contact from './pages/Contact.jsx';
import NotFound from './pages/NotFound.jsx';

/** Client-side navigation should start each page at the top. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ScrollToTop />
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/camp" element={<Camp />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
