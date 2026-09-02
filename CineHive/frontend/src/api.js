// api.js — talks to the CineHive Express backend
const BASE_URL = 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('cinehive_token');
}

function setToken(token) {
  localStorage.setItem('cinehive_token', token);
}

function clearToken() {
  localStorage.removeItem('cinehive_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (username, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getMovies: () => request('/movies'),

  getMovie: (id) => request(`/movies/${id}`),

  getShowtimes: (movieId) => request(`/movies/${movieId}/showtimes`),

  getSeats: (showtimeId) => request(`/showtimes/${showtimeId}/seats`),

  createBooking: (showtimeId, seatIds) =>
    request('/bookings', { method: 'POST', body: JSON.stringify({ showtimeId, seatIds }) }),

  getCast: (movieId) => request(`/movies/${movieId}/cast`),
  getMovieDirectors: (movieId) => request(`/movies/${movieId}/directors`),
  getActor: (id) => request(`/actors/${id}`),
  getDirector: (id) => request(`/directors/${id}`),

  getWatchlist: () => request('/watchlist'),
  addToWatchlist: (movieId) => request('/watchlist', { method: 'POST', body: JSON.stringify({ movieId }) }),
  removeFromWatchlist: (movieId) => request(`/watchlist/${movieId}`, { method: 'DELETE' }),

  getReviews: (movieId) => request(`/movies/${movieId}/reviews`),
  postReview: (movieId, reviewText) =>
    request(`/movies/${movieId}/reviews`, { method: 'POST', body: JSON.stringify({ reviewText }) }),

  getRating: (movieId) => request(`/movies/${movieId}/rating`),
  setRating: (movieId, ratingValue) =>
    request(`/movies/${movieId}/rating`, { method: 'POST', body: JSON.stringify({ ratingValue }) }),

  getMyBookings: () => request('/bookings/me'),

  isLoggedIn: () => !!getToken(),
  logout: clearToken,
  saveToken: setToken,
};