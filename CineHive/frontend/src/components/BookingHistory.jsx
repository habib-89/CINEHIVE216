import { useEffect, useState } from 'react';
import { api } from '../api';

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="section-heading">
        <h2>My Bookings</h2>
        {!loading && !error && <span className="count">{bookings.length} bookings</span>}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && bookings.length === 0 && !error && (
        <p className="movie-meta">No bookings yet — grab a showtime from Now Showing.</p>
      )}

      <div className="booking-history-list">
        {bookings.map((b) => (
          <div key={b.BOOKING_ID} className="booking-history-item">
            {b.POSTER_URL && <img src={b.POSTER_URL} alt={b.TITLE} className="booking-thumb" />}
            <div className="booking-history-details">
              <h3>{b.TITLE}</h3>
              <p className="movie-meta">
                {new Date(b.SHOW_DATE).toLocaleDateString()} &middot; {new Date(b.START_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="movie-meta">{b.SEAT_COUNT} seat(s) &middot; Booked {new Date(b.BOOKING_DATE).toLocaleDateString()}</p>
            </div>
            <div className="booking-history-right">
              <span className={`status-badge status-${b.PAYMENT_STATUS?.toLowerCase()}`}>{b.PAYMENT_STATUS}</span>
              <span className="ticket-price">${b.TOTAL_AMOUNT}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}