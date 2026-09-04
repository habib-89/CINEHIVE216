import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MovieDetail({ movieId, role, onSelectShowtime, onSelectPerson, onBack }) {
  const isCustomer = role === 'CUSTOMER';
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [cast, setCast] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [rating, setRating] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setError('');
    Promise.all([
      api.getMovie(movieId),
      api.getShowtimes(movieId),
      api.getCast(movieId),
      api.getMovieDirectors(movieId),
      api.getRating(movieId),
      api.getReviews(movieId),
    ])
      .then(([movieData, showtimeData, castData, directorData, ratingData, reviewData]) => {
        setMovie(movieData);
        setShowtimes(showtimeData);
        setCast(castData);
        setDirectors(directorData);
        setRating(ratingData);
        setReviews(reviewData);
      })
      .catch((err) => setError(err.message));

    if (isCustomer) {
      api.getWatchlist()
        .then((list) => setInWatchlist(list.some((m) => m.MOVIE_ID === Number(movieId))))
        .catch(() => {});
    }
  }, [movieId, isCustomer]);

  async function toggleWatchlist() {
    try {
      if (inWatchlist) {
        await api.removeFromWatchlist(movieId);
        setInWatchlist(false);
      } else {
        await api.addToWatchlist(movieId);
        setInWatchlist(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRate(value) {
    try {
      await api.setRating(movieId, value);
      const updated = await api.getRating(movieId);
      setRating(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      await api.postReview(movieId, reviewText);
      const updated = await api.getReviews(movieId);
      setReviews(updated);
      setReviewText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  if (error && !movie) return <p className="error">{error}</p>;
  if (!movie) return <p>Loading...</p>;

  return (
    <div className="movie-detail">
      <button className="back-button" onClick={onBack}>&larr; All movies</button>

      <div className="movie-detail-header">
        {movie.POSTER_URL && <img src={movie.POSTER_URL} alt={movie.TITLE} className="movie-poster-large" />}
        <div>
          <h2>{movie.TITLE}</h2>
          <p className="movie-meta">
            {movie.LANGUAGE} &middot; {movie.DURATION} min &middot; {new Date(movie.RELEASE_DATE).getFullYear()}
          </p>
          {directors.length > 0 && (
            <p className="movie-meta">
              Directed by{' '}
              {directors.map((d, i) => (
                <span key={d.DIRECTOR_ID}>
                  <button className="link-button inline" onClick={() => onSelectPerson(d.DIRECTOR_ID, 'director')}>
                    {d.DIRECTOR_NAME}
                  </button>
                  {i < directors.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          )}

          {rating && (
            <div className="rating-widget">
              <span className="avg-rating">
                {rating.AVG_RATING ?? '—'}<span className="out-of">/10</span>
              </span>
              <span className="movie-meta">({rating.RATING_COUNT ?? 0} ratings)</span>
              {isCustomer && (
                <div className="rate-stars">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <button
                      key={i}
                      className={`star ${rating.myRating && i < rating.myRating ? 'filled' : ''}`}
                      onClick={() => handleRate(i + 1)}
                      title={`Rate ${i + 1}/10`}
                    >
                      &#9733;
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="description">{movie.DESCRIPTION}</p>

          {isCustomer && (
            <button className={`btn-secondary ${inWatchlist ? 'active' : ''}`} onClick={toggleWatchlist}>
              {inWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist'}
            </button>
          )}
        </div>
      </div>

      {cast.length > 0 && (
        <>
          <div className="section-heading"><h2>Cast</h2></div>
          <div className="person-strip">
            {cast.map((c) => (
              <div key={c.ACTOR_ID} className="person-chip" onClick={() => onSelectPerson(c.ACTOR_ID, 'actor')}>
                {c.PHOTO_URL && <img src={c.PHOTO_URL} alt={c.ACTOR_NAME} />}
                <span className="person-chip-name">{c.ACTOR_NAME}</span>
                <span className="person-chip-role">{c.ROLE}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-heading"><h2>Showtimes</h2></div>
      {showtimes.length === 0 && <p className="movie-meta">No showtimes scheduled.</p>}
      <div className="showtime-list">
        {showtimes.map((st) => (
          <button
            key={st.SHOWTIME_ID}
            className="ticket-stub"
            disabled={!isCustomer}
            onClick={() => isCustomer && onSelectShowtime(st.SHOWTIME_ID)}
            title={isCustomer ? 'Choose seats' : 'Only customers can book tickets'}
          >
            <div className="ticket-main">
              <span className="ticket-date">
                {new Date(st.SHOW_DATE).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="ticket-time">
                {new Date(st.START_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="ticket-perforation" />
            <div className="ticket-price">${st.TICKET_PRICE}</div>
          </button>
        ))}
      </div>

      <div className="section-heading"><h2>Reviews</h2></div>
      {isCustomer && (
        <form onSubmit={handleReviewSubmit} className="review-form">
          <textarea
            placeholder="Share your thoughts..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
          />
          <button className="btn-primary" disabled={submittingReview || !reviewText.trim()}>
            {submittingReview ? 'Posting...' : 'Post Review'}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div className="review-list">
        {reviews.length === 0 && <p className="movie-meta">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.REVIEW_ID} className="review-item">
            <div className="review-item-header">
              <span className="review-username">{r.USERNAME}</span>
              <span className="review-date">{new Date(r.REVIEW_DATE).toLocaleDateString()}</span>
            </div>
            <p>{r.REVIEW_TEXT}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
