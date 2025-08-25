import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  return (
    <nav className="navbar">
      <ul>
        <li><NavLink to="/" className={linkClass}>Home</NavLink></li>
        <li><NavLink to="/music" className={linkClass}>Music</NavLink></li>
        <li><NavLink to="/media" className={linkClass}>Media</NavLink></li>
        <li><NavLink to="/merch" className={linkClass}>Merch</NavLink></li>
        <li><NavLink to="/about" className={linkClass}>About</NavLink></li>
      </ul>
    </nav>
  );
}
