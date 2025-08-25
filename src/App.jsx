import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Music from './pages/Music.jsx';
import Media from './pages/Media.jsx';
import Merch from './pages/Merch.jsx';
import About from './pages/About.jsx';

export default function App() {
  return (
    <div>
      <Navbar />
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
