import { Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
// Home is the landing route, so it stays in the main bundle. Every other
// route is split out and fetched on demand.
import Home from './pages/Home.jsx';

const Camp = lazy(() => import('./pages/Camp.jsx'));
const Playlists = lazy(() => import('./pages/Playlists.jsx'));
const Videos = lazy(() => import('./pages/Videos.jsx'));
const Merch = lazy(() => import('./pages/Merch.jsx'));
const Staff = lazy(() => import('./pages/Staff.jsx'));
const Faq = lazy(() => import('./pages/Faq.jsx'));
const Registration = lazy(() => import('./pages/Registration.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const Blog = lazy(() => import('./pages/Blog.jsx'));
const BlogPost = lazy(() => import('./pages/BlogPost.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

/** Client-side navigation should start each page at the top. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

/** Reserves vertical space while a split route loads, so the footer doesn't
 *  jump up into view and cause a layout shift. */
function RouteFallback() {
  return <div className="route-fallback" aria-busy="true" />;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ScrollToTop />
      <Navbar />
      <main id="main">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/camp" element={<Camp />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/merch" element={<Merch />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/registration" element={<Registration />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
