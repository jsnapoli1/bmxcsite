import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Music from './pages/Music.jsx';
import Media from './pages/Media.jsx';
import Merch from './pages/Merch.jsx';
import About from './pages/About.jsx';

export default function App() {
  return (
    <div>
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/music">Music</Link></li>
          <li><Link to="/media">Media</Link></li>
          <li><Link to="/merch">Merch</Link></li>
          <li><Link to="/about">About</Link></li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/music" element={<Music />} />
        <Route path="/media" element={<Media />} />
        <Route path="/merch" element={<Merch />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  );
}
