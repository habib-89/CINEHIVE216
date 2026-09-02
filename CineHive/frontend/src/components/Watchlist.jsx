import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Watchlist({ onSelectMovie }) {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    api.getWatchlist()
      .then(setMovies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleRemove(movieId) {
    try {
      await api.removeFromWatchlist(movieId);
      setMovies((prev) => prev.filter((m) => m.MOVIE_ID !== movieId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <h2>My Watchlist</h2>
        {!loading && !error && <span className="count">{movies.length} saved</span>}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && movies.length === 0 && !error && (
        <p className="movie-meta">Nothing saved yet — add movies from their detail page.</p>
      )}

      <div className="movie-grid">
        {movies.map((movie) => (
          <div key={movie.MOVIE_ID} className="movie-card">
            <div className="poster-wrap" onClick={() => onSelectMovie(movie.MOVIE_ID)}>
              {movie.POSTER_URL && <img src={movie.POSTER_URL} alt={movie.TITLE} className="movie-poster" />}
              <span className="runtime-badge">{movie.DURATION}m</span>
            </div>
            <h3>{movie.TITLE}</h3>
            <div className="watchlist-card-footer">
              <p className="movie-meta">{movie.LANGUAGE}</p>
              <button className="link-button small" onClick={() => handleRemove(movie.MOVIE_ID)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}