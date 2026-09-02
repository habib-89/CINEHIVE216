import { useState } from 'react';
import { api } from './api';
import Auth from './components/Auth';
import MovieList from './components/MovieList';
import MovieDetail from './components/MovieDetail';
import SeatPicker from './components/SeatPicker';
import Watchlist from './components/Watchlist';
import BookingHistory from './components/BookingHistory';
import PersonDetail from './components/PersonDetail';
import './App.css';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn());
  const [tab, setTab] = useState('movies'); // 'movies' | 'watchlist' | 'bookings'
  const [view, setView] = useState('list'); // 'list' | 'movie' | 'seats' | 'person'
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null); // { id, type }

  function handleLogout() {
    api.logout();
    setLoggedIn(false);
  }

  function goToMovie(id) {
    setSelectedMovieId(id);
    setView('movie');
  }

  function switchTab(newTab) {
    setTab(newTab);
    setView('list');
  }

  if (!loggedIn) {
    return <Auth onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app-container">
      <header className="marquee">
        <div className="wordmark">
          <h1>CINE<span>HIVE</span></h1>
        </div>
        <div className="header-actions">
          <button className="link-button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab ${tab === 'movies' ? 'active' : ''}`} onClick={() => switchTab('movies')}>Now Showing</button>
        <button className={`tab ${tab === 'watchlist' ? 'active' : ''}`} onClick={() => switchTab('watchlist')}>Watchlist</button>
        <button className={`tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => switchTab('bookings')}>My Bookings</button>
      </nav>

      {view === 'list' && tab === 'movies' && <MovieList onSelectMovie={goToMovie} />}
      {view === 'list' && tab === 'watchlist' && <Watchlist onSelectMovie={goToMovie} />}
      {view === 'list' && tab === 'bookings' && <BookingHistory />}

      {view === 'movie' && (
        <MovieDetail
          movieId={selectedMovieId}
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