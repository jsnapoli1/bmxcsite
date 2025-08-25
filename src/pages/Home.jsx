import { Link } from 'react-router-dom';
import Carousel from '../components/Carousel.jsx';

export default function Home() {
  const stockImages = [
    'https://images.unsplash.com/photo-1526318472351-bc6d1a96e579?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1502810190503-83002708f736?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1508766206392-8bd5cf550d1d?auto=format&fit=crop&w=800&q=80'
  ];

  return (
    <div>
      <h1>BMXC Camp</h1>
      <p>50+ years of great training, creating friends, strengthening teams, and tradition</p>
      <p>
        Founded in 1969, Blue Mountain Cross Country Camp is the oldest and longest running XC summer camp in the Northeast! We're a sleepover running camp for students entering grade 7th-12th and are dedicated to fostering a love for running and providing an environment in which student athletes are healthy and successful. Individuals and teams come from all over New York, Pennsylvania, & New Jersey to kick off their season and develop friendships that span beyond their running years in high school.
      </p>
      <Carousel images={stockImages} />
      {/* Example using a Facebook album */}
      {/* <Carousel albumId="YOUR_FACEBOOK_ALBUM_ID" images={[]} /> */}
      <p><Link to="/about">Get in touch with us!</Link></p>
    </div>
  );
}
