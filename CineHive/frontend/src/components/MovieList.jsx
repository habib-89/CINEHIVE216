import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MovieList({ onSelectMovie }) {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMovies()
      .then(setMovies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="section-heading">
        <h2>Now Showing</h2>
        {!loading && !error && <span className="count">{movies.length} titles</span>}
      </div>

      {loading && <p>Loading movies...</p>}
      {error && <p className="error">{error}</p>}

      <div className="movie-grid">
        {movies.map((movie) => (
          <div key={movie.MOVIE_ID} className="movie-card" onClick={() => onSelectMovie(movie.MOVIE_ID)}>
            <div className="poster-wrap">
              <div className="sprockets top">{Array.from({ length: 8 }).map((_, i) => <span key={i} />)}</div>
              {movie.POSTER_URL && <img src={movie.POSTER_URL} alt={movie.TITLE} className="movie-poster" />}
              <div className="sprockets bottom">{Array.from({ length: 8 }).map((_, i) => <span key={i} />)}</div>
              <span className="runtime-badge">{movie.DURATION}m</span>
            </div>
            <h3>{movie.TITLE}</h3>
            <p className="movie-meta">{movie.LANGUAGE}</p>
          </div>
        ))}
      </div>
    </div>
  );
}