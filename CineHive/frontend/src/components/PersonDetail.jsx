import { useEffect, useState } from 'react';
import { api } from '../api';

export default function PersonDetail({ personId, type, onSelectMovie, onBack }) {
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetcher = type === 'actor' ? api.getActor : api.getDirector;
    fetcher(personId).then(setPerson).catch((err) => setError(err.message));
  }, [personId, type]);

  if (error) return <p className="error">{error}</p>;
  if (!person) return <p>Loading...</p>;

  const name = type === 'actor' ? person.ACTOR_NAME : person.DIRECTOR_NAME;

  return (
    <div>
      <button className="back-button" onClick={onBack}>&larr; Back</button>
      <div className="person-header">
        {person.PHOTO_URL && <img src={person.PHOTO_URL} alt={name} className="person-photo" />}
        <div>
          <h2>{name}</h2>
          <p className="movie-meta">
            {person.NATIONALITY} &middot; born {new Date(person.DATE_OF_BIRTH).toLocaleDateString()}
          </p>
          <p className="description">{person.BIOGRAPHY}</p>
        </div>
      </div>

      <div className="section-heading">
        <h2>Filmography</h2>
      </div>
      <div className="movie-grid">
        {person.filmography.map((movie) => (
          <div key={movie.MOVIE_ID} className="movie-card" onClick={() => onSelectMovie(movie.MOVIE_ID)}>
            <div className="poster-wrap">
              {movie.POSTER_URL && <img src={movie.POSTER_URL} alt={movie.TITLE} className="movie-poster" />}
            </div>
            <h3>{movie.TITLE}</h3>
            {movie.ROLE && <p className="movie-meta">as {movie.ROLE}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}