import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminDashboard().then(setDashboard).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!dashboard) return <p>Loading dashboard...</p>;

  const stats = [
    ['Registered users', dashboard.USER_COUNT],
    ['Movies', dashboard.MOVIE_COUNT],
    ['Bookings', dashboard.BOOKING_COUNT],
    ['Booking revenue', dashboard.BOOKING_REVENUE],
  ];

  return (
    <section className="content-section">
      <div className="eyebrow"><span className="dot" />Administrator only</div>
      <h2>Operations dashboard</h2>
      <div className="admin-stats">
        {stats.map(([label, value]) => (
          <article className="admin-stat" key={label}>
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
