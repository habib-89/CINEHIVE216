import { useEffect, useState } from 'react';
import { api } from '../api';

export default function SeatPicker({ showtimeId, onBooked, onBack }) {
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getSeats(showtimeId).then(setSeats).catch((err) => setError(err.message));
  }, [showtimeId]);

  function toggleSeat(seatId) {
    setSelected((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  }

  async function handleBook() {
    if (selected.length === 0) return;
    setBooking(true);
    setError('');
    try {
      const res = await api.createBooking(showtimeId, selected);
      setResult(res);
      onBooked?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  }

  if (result) {
    return (
      <div className="booking-confirmation">
        <div className="ticket-receipt">
          <div className="ticket-receipt-main">
            <div className="eyebrow"><span className="dot" />Confirmed</div>
            <h2>You're In</h2>
            <div className="ticket-row">
              <span className="label">Booking ID</span>
              <span className="value">#{String(result.bookingId).padStart(5, '0')}</span>
            </div>
            <div className="ticket-row">
              <span className="label">Seats</span>
              <span className="value">{result.seatCount}</span>
            </div>
            <div className="ticket-row">
              <span className="label">Total paid</span>
              <span className="value">${result.totalAmount}</span>
            </div>
            <button className="btn-primary" onClick={onBack}>Back to Now Showing</button>
          </div>
          <div className="ticket-receipt-stub">ADMIT {result.seatCount}</div>
        </div>
      </div>
    );
  }

  const seatsByRow = seats.reduce((acc, seat) => {
    (acc[seat.ROW_NUMBER] ||= []).push(seat);
    return acc;
  }, {});

  return (
    <div className="seat-picker">
      <button className="back-button" onClick={onBack}>&larr; Back</button>
      <h2>Choose Your Seats</h2>

      <div className="screen-arc-wrap">
        <svg width="280" height="50" viewBox="0 0 280 50">
          <path d="M 10 10 Q 140 50 270 10" stroke="#e8b86d" strokeWidth="2" fill="none" opacity="0.5" />
        </svg>
      </div>
      <p className="screen-label">S C R E E N</p>

      {error && <p className="error">{error}</p>}
      {seats.length === 0 && !error && <p className="movie-meta">No seats available for this showtime.</p>}

      <div className="seat-map">
        {Object.entries(seatsByRow).map(([row, rowSeats]) => (
          <div key={row} className="seat-row">
            <span className="row-label">{row}</span>
            {rowSeats.map((seat) => (
              <button
                key={seat.SEAT_ID}
                className={`seat seat-${seat.SEAT_TYPE?.toLowerCase()} ${selected.includes(seat.SEAT_ID) ? 'selected' : ''}`}
                onClick={() => toggleSeat(seat.SEAT_ID)}
                title={`${seat.SEAT_TYPE} - Seat ${seat.SEAT_NUMBER}`}
              >
                {seat.SEAT_NUMBER}
              </button>
            ))}
          </div>
        ))}
      </div>

      {seats.length > 0 && (
        <div className="seat-legend">
          <span className="legend-item"><span className="legend-swatch" /> Regular</span>
          <span className="legend-item"><span className="legend-swatch premium" /> Premium</span>
          <span className="legend-item"><span className="legend-swatch selected" /> Selected</span>
        </div>
      )}

      <div className="booking-bar">
        <span className="seat-count">{selected.length} seat(s) selected</span>
        <button className="btn-primary" onClick={handleBook} disabled={selected.length === 0 || booking}>
          {booking ? 'Booking...' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  );
}