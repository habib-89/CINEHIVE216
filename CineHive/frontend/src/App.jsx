import { useState } from 'react';
import { api } from './api';
import Auth from './components/Auth';
import MovieList from './components/MovieList';
import MovieDetail from './components/MovieDetail';
import SeatPicker from './components/SeatPicker';
import Watchlist from './components/Watchlist';
import BookingHistory from './components/BookingHistory';
import PersonDetail from './components/PersonDetail';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn());
  const [session, setSession] = useState(api.getSession());
  const [tab, setTab] = useState('movies'); // 'movies' | 'watchlist' | 'bookings'
  const [view, setView] = useState('list'); // 'list' | 'movie' | 'seats' | 'person'
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null); // { id, type }

  async function handleLogout() {
    await api.logout();
    setLoggedIn(false);
    setSession(null);
  }

  function goToMovie(id) {
    setSelectedMovieId(id);
    setView('movie');
  }

  function switchTab(newTab) {
    setTab(newTab);
    setView('list');
  }

  if (!loggedIn || !session) {
    return <Auth onLoggedIn={(newSession) => { setSession({ userId: newSession.userId, username: newSession.username, role: newSession.role }); setLoggedIn(true); }} />;
  }

  return (
    <div className="app-container">
      <header className="marquee">
        <div className="wordmark">
          <h1>CINE<span>HIVE</span></h1>
        </div>
        <div className="header-actions">
          <span className="role-badge">{session.role}</span>
          <button className="link-button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab ${tab === 'movies' ? 'active' : ''}`} onClick={() => switchTab('movies')}>Now Showing</button>
        {session.role === 'CUSTOMER' && <button className={`tab ${tab === 'watchlist' ? 'active' : ''}`} onClick={() => switchTab('watchlist')}>Watchlist</button>}
        {session.role === 'CUSTOMER' && <button className={`tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => switchTab('bookings')}>My Bookings</button>}
        {session.role === 'ADMIN' && <button className={`tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => switchTab('admin')}>Admin dashboard</button>}
      </nav>

      {view === 'list' && tab === 'movies' && <MovieList onSelectMovie={goToMovie} />}
      {view === 'list' && tab === 'watchlist' && <Watchlist onSelectMovie={goToMovie} />}
      {view === 'list' && tab === 'bookings' && <BookingHistory />}
      {view === 'list' && tab === 'admin' && <AdminDashboard />}

      {view === 'movie' && (
        <MovieDetail
          movieId={selectedMovieId}
          role={session.role}
          onSelectShowtime={(id) => { setSelectedShowtimeId(id); setView('seats'); }}
          onSelectPerson={(id, type) => { setSelectedPerson({ id, type }); setView('person'); }}
          onBack={() => setView('list')}
        />
      )}

      {view === 'seats' && (
        <SeatPicker
          showtimeId={selectedShowtimeId}
          onBack={() => { setView('list'); setTab('movies'); }}
        />
      )}

      {view === 'person' && selectedPerson && (
        <PersonDetail
          personId={selectedPerson.id}
          type={selectedPerson.type}
          onSelectMovie={goToMovie}
          onBack={() => setView('movie')}
        />
      )}
    </div>
  );
}
