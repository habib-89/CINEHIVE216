// server.js — CineHive backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured');
}

function issueToken(user) {
  return jwt.sign(
    { userId: user.USER_ID, username: user.USERNAME, jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// --- Auth routes ---

// Register a new user
// Expects JSON body: { username, email, password, dateOfBirth }
app.post('/auth/register', async (req, res) => {
  const { username, email, password, dateOfBirth } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.execute(
      `INSERT INTO APP_USER (USERNAME, EMAIL, PASSWORD_HASH, DATE_OF_BIRTH, DATE_JOINED, ROLE)
       VALUES (:username, :email, :passwordHash, :dateOfBirth, SYSDATE, 'CUSTOMER')
       RETURNING USER_ID INTO :userId`,
      {
        username,
        email,
        passwordHash,
        dateOfBirth: dateOfBirth || null,
        userId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER }
      }
    );
    const userId = result.outBinds.userId[0];

    const user = { USER_ID: userId, USERNAME: username, ROLE: 'CUSTOMER' };
    const token = issueToken(user);
    res.status(201).json({ message: 'User registered', userId, username, role: user.ROLE, token });
  } catch (err) {
    console.error(err);
    if (err.errorNum === 1) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Log in an existing user
// Expects JSON body: { email, password }
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await db.execute(
      `SELECT USER_ID, USERNAME, PASSWORD_HASH, ROLE FROM APP_USER WHERE EMAIL = :email`,
      { email }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = issueToken(user);
    res.json({ message: 'Login successful', userId: user.USER_ID, username: user.USERNAME, role: user.ROLE, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Middleware: verifies the JWT, checks server-side logout, and resolves the role from Oracle.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const revoked = await db.execute(
      `SELECT 1 FROM TOKEN_REVOCATION WHERE TOKEN_JTI = :jti`,
      { jti: payload.jti }
    );
    if (revoked.rows.length > 0) {
      return res.status(401).json({ error: 'This session has been logged out' });
    }

    const userResult = await db.execute(
      `SELECT USER_ID, USERNAME, ROLE FROM APP_USER WHERE USER_ID = :userId`,
      { userId: payload.userId }
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists' });
    }
    const currentUser = userResult.rows[0];
    req.user = {
      userId: currentUser.USER_ID,
      username: currentUser.USERNAME,
      role: currentUser.ROLE,
      tokenJti: payload.jti,
      tokenExpiry: payload.exp
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to use this feature' });
    }
    next();
  };
}

// Customer actions are deliberately guarded on the server as well as hidden in
// the UI. This prevents an administrator token from calling them directly.
const requireCustomer = requireRole('CUSTOMER');

// Logout invalidates this JWT server-side. TOKEN_REVOCATION is created by db/60_percent_migration.sql.
app.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    await db.execute(
      `INSERT INTO TOKEN_REVOCATION (TOKEN_JTI, EXPIRES_AT) VALUES (:jti, TO_TIMESTAMP_TZ(:expiresAt, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'))`,
      { jti: req.user.tokenJti, expiresAt: new Date(req.user.tokenExpiry * 1000).toISOString() }
    );
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to log out' });
  }
});

// --- Routes ---

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'CineHive API is running' });
});

// Admin-only operational summary. This is deliberately server-side protected.
app.get('/admin/dashboard', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM APP_USER) AS USER_COUNT,
         (SELECT COUNT(*) FROM MOVIE) AS MOVIE_COUNT,
         (SELECT COUNT(*) FROM BOOKING) AS BOOKING_COUNT,
         (SELECT NVL(SUM(TOTAL_AMOUNT), 0) FROM BOOKING) AS BOOKING_REVENUE
       FROM dual`
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
});

// Get all movies
app.get('/movies', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT MOVIE_ID, TITLE, RELEASE_DATE, DURATION, LANGUAGE,
              DESCRIPTION, TRAILER_URL, POSTER_URL, BOX_OFFICE, BUDGET
       FROM MOVIE
       ORDER BY MOVIE_ID`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Get a single movie by ID
app.get('/movies/:id', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT MOVIE_ID, TITLE, RELEASE_DATE, DURATION, LANGUAGE,
              DESCRIPTION, TRAILER_URL, POSTER_URL, BOX_OFFICE, BUDGET
       FROM MOVIE
       WHERE MOVIE_ID = :id`,
      { id: req.params.id }
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

// Get showtimes for a movie
app.get('/movies/:id/showtimes', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT SHOWTIME_ID, MOVIE_ID, SCREEN_ID, SHOW_DATE, START_TIME, END_TIME, TICKET_PRICE
       FROM SHOWTIME
       WHERE MOVIE_ID = :id
       ORDER BY SHOW_DATE, START_TIME`,
      { id: req.params.id }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
});

// Get available seats for a showtime (seats on that screen not already booked for this showtime)
app.get('/showtimes/:id/seats', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT s.SEAT_ID, s.ROW_NUMBER, s.SEAT_NUMBER, s.SEAT_TYPE
       FROM SEAT s
       JOIN SHOWTIME st ON st.SCREEN_ID = s.SCREEN_ID
       WHERE st.SHOWTIME_ID = :id
         AND s.SEAT_ID NOT IN (
           SELECT bs.SEAT_ID FROM BOOKING_SEAT bs WHERE bs.SHOWTIME_ID = :id
         )
       ORDER BY s.ROW_NUMBER, s.SEAT_NUMBER`,
      { id: req.params.id }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// Create a booking with one or more seats (customer-only)
// Expects JSON body: { showtimeId, seatIds: [1,2,3] }
app.post('/bookings', requireAuth, requireCustomer, async (req, res) => {
  const userId = req.user.userId;
  const { showtimeId, seatIds } = req.body;

  if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ error: 'showtimeId and a non-empty seatIds array are required' });
  }

  let connection;
  try {
    connection = await db.getRawConnection();

    // Look up ticket price for this showtime
    const priceResult = await connection.execute(
      `SELECT TICKET_PRICE FROM SHOWTIME WHERE SHOWTIME_ID = :showtimeId`,
      { showtimeId }
    );
    if (priceResult.rows.length === 0) {
      await connection.close();
      return res.status(404).json({ error: 'Showtime not found' });
    }
    const ticketPrice = priceResult.rows[0].TICKET_PRICE;
    const totalAmount = ticketPrice * seatIds.length;

    // Insert the booking, capturing the generated BOOKING_ID
    const bookingResult = await connection.execute(
      `INSERT INTO BOOKING (USER_ID, SHOWTIME_ID, BOOKING_DATE, TOTAL_AMOUNT, PAYMENT_STATUS)
       VALUES (:userId, :showtimeId, SYSTIMESTAMP, :totalAmount, 'PENDING')
       RETURNING BOOKING_ID INTO :bookingId`,
      {
        userId,
        showtimeId,
        totalAmount,
        bookingId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER }
      },
      { autoCommit: false }
    );
    const bookingId = bookingResult.outBinds.bookingId[0];

    // Insert one BOOKING_SEAT row per seat
    for (const seatId of seatIds) {
      await connection.execute(
        `INSERT INTO BOOKING_SEAT (BOOKING_ID, SHOWTIME_ID, SEAT_ID)
         VALUES (:bookingId, :showtimeId, :seatId)`,
        { bookingId, showtimeId, seatId },
        { autoCommit: false }
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Booking created', bookingId, totalAmount, seatCount: seatIds.length });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    // ORA-00001 = unique constraint violation, likely a seat already booked
    if (err.errorNum === 1) {
      return res.status(409).json({ error: 'One or more selected seats are already booked' });
    }
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// --- Cast & crew ---

// Get cast for a movie
app.get('/movies/:id/cast', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT a.ACTOR_ID, a.ACTOR_NAME, a.PHOTO_URL, ai.ROLE
       FROM ACTS_IN ai
       JOIN ACTOR a ON a.ACTOR_ID = ai.ACTOR_ID
       WHERE ai.MOVIE_ID = :id
       ORDER BY ai.ACTOR_ID`,
      { id: req.params.id }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cast' });
  }
});

// Get director(s) for a movie
app.get('/movies/:id/directors', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT d.DIRECTOR_ID, d.DIRECTOR_NAME, d.PHOTO_URL
       FROM DIRECTS dr
       JOIN DIRECTOR d ON d.DIRECTOR_ID = dr.DIRECTOR_ID
       WHERE dr.MOVIE_ID = :id`,
      { id: req.params.id }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch directors' });
  }
});

// Get an actor's profile + filmography
app.get('/actors/:id', async (req, res) => {
  try {
    const actorResult = await db.execute(
      `SELECT ACTOR_ID, ACTOR_NAME, DATE_OF_BIRTH, NATIONALITY, PHOTO_URL, BIOGRAPHY
       FROM ACTOR WHERE ACTOR_ID = :id`,
      { id: req.params.id }
    );
    if (actorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    const filmographyResult = await db.execute(
      `SELECT m.MOVIE_ID, m.TITLE, m.POSTER_URL, m.RELEASE_DATE, ai.ROLE
       FROM ACTS_IN ai
       JOIN MOVIE m ON m.MOVIE_ID = ai.MOVIE_ID
       WHERE ai.ACTOR_ID = :id
       ORDER BY m.RELEASE_DATE DESC`,
      { id: req.params.id }
    );
    res.json({ ...actorResult.rows[0], filmography: filmographyResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch actor' });
  }
});

// Get a director's profile + filmography
app.get('/directors/:id', async (req, res) => {
  try {
    const directorResult = await db.execute(
      `SELECT DIRECTOR_ID, DIRECTOR_NAME, DATE_OF_BIRTH, NATIONALITY, PHOTO_URL, BIOGRAPHY
       FROM DIRECTOR WHERE DIRECTOR_ID = :id`,
      { id: req.params.id }
    );
    if (directorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Director not found' });
    }
    const filmographyResult = await db.execute(
      `SELECT m.MOVIE_ID, m.TITLE, m.POSTER_URL, m.RELEASE_DATE
       FROM DIRECTS dr
       JOIN MOVIE m ON m.MOVIE_ID = dr.MOVIE_ID
       WHERE dr.DIRECTOR_ID = :id
       ORDER BY m.RELEASE_DATE DESC`,
      { id: req.params.id }
    );
    res.json({ ...directorResult.rows[0], filmography: filmographyResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch director' });
  }
});

// --- Watchlist (customer-only) ---

// Get the logged-in user's watchlist
app.get('/watchlist', requireAuth, requireCustomer, async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT m.MOVIE_ID, m.TITLE, m.POSTER_URL, m.DURATION, m.LANGUAGE, w.ADDED_DATE
       FROM WATCHLIST w
       JOIN MOVIE m ON m.MOVIE_ID = w.MOVIE_ID
       WHERE w.USER_ID = :userId
       ORDER BY w.ADDED_DATE DESC`,
      { userId: req.user.userId }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add a movie to the watchlist
app.post('/watchlist', requireAuth, requireCustomer, async (req, res) => {
  const { movieId } = req.body;
  if (!movieId) return res.status(400).json({ error: 'movieId is required' });

  try {
    await db.execute(
      `INSERT INTO WATCHLIST (USER_ID, MOVIE_ID, ADDED_DATE) VALUES (:userId, :movieId, SYSTIMESTAMP)`,
      { userId: req.user.userId, movieId }
    );
    res.status(201).json({ message: 'Added to watchlist' });
  } catch (err) {
    console.error(err);
    if (err.errorNum === 1) {
      return res.status(409).json({ error: 'Movie already in watchlist' });
    }
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove a movie from the watchlist
app.delete('/watchlist/:movieId', requireAuth, requireCustomer, async (req, res) => {
  try {
    const result = await db.execute(
      `DELETE FROM WATCHLIST WHERE USER_ID = :userId AND MOVIE_ID = :movieId`,
      { userId: req.user.userId, movieId: req.params.movieId }
    );
    res.json({ message: 'Removed from watchlist', rowsAffected: result.rowsAffected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// --- Reviews & ratings ---

// Get reviews for a movie (with reviewer usernames)
app.get('/movies/:id/reviews', async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT r.REVIEW_ID, r.USER_ID, u.USERNAME, r.REVIEW_TEXT, r.REVIEW_DATE
       FROM REVIEW r
       JOIN APP_USER u ON u.USER_ID = r.USER_ID
       WHERE r.MOVIE_ID = :id
       ORDER BY r.REVIEW_DATE DESC`,
      { id: req.params.id }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Post a review (customer-only)
app.post('/movies/:id/reviews', requireAuth, requireCustomer, async (req, res) => {
  const { reviewText } = req.body;
  if (!reviewText) return res.status(400).json({ error: 'reviewText is required' });

  try {
    const result = await db.execute(
      `INSERT INTO REVIEW (USER_ID, MOVIE_ID, REVIEW_TEXT, REVIEW_DATE)
       VALUES (:userId, :movieId, :reviewText, SYSTIMESTAMP)
       RETURNING REVIEW_ID INTO :reviewId`,
      {
        userId: req.user.userId,
        movieId: req.params.id,
        reviewText,
        reviewId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER }
      }
    );
    res.status(201).json({ message: 'Review posted', reviewId: result.outBinds.reviewId[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post review' });
  }
});

// Get average rating + the logged-in user's own rating (if logged in)
app.get('/movies/:id/rating', async (req, res) => {
  try {
    const avgResult = await db.execute(
      `SELECT ROUND(AVG(RATING_VALUE), 1) AS AVG_RATING, COUNT(*) AS RATING_COUNT
       FROM RATING WHERE MOVIE_ID = :id`,
      { id: req.params.id }
    );

    let myRating = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const mine = await db.execute(
          `SELECT RATING_VALUE FROM RATING WHERE USER_ID = :userId AND MOVIE_ID = :movieId`,
          { userId: payload.userId, movieId: req.params.id }
        );
        if (mine.rows.length > 0) myRating = mine.rows[0].RATING_VALUE;
      } catch (e) { /* invalid token, treat as anonymous */ }
    }

    res.json({ ...avgResult.rows[0], myRating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

// Set (or update) the logged-in customer's rating for a movie
app.post('/movies/:id/rating', requireAuth, requireCustomer, async (req, res) => {
  const { ratingValue } = req.body;
  if (ratingValue == null || ratingValue < 0 || ratingValue > 10) {
    return res.status(400).json({ error: 'ratingValue must be between 0 and 10' });
  }

  try {
    await db.execute(
      `MERGE INTO RATING r
       USING (SELECT :userId AS USER_ID, :movieId AS MOVIE_ID FROM dual) src
       ON (r.USER_ID = src.USER_ID AND r.MOVIE_ID = src.MOVIE_ID)
       WHEN MATCHED THEN UPDATE SET RATING_VALUE = :ratingValue, RATING_DATE = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (USER_ID, MOVIE_ID, RATING_VALUE, RATING_DATE)
         VALUES (:userId, :movieId, :ratingValue, SYSTIMESTAMP)`,
      { userId: req.user.userId, movieId: req.params.id, ratingValue }
    );
    res.json({ message: 'Rating saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// --- Booking history ---

// Get the logged-in user's past bookings
app.get('/bookings/me', requireAuth, requireCustomer, async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT b.BOOKING_ID, b.BOOKING_DATE, b.TOTAL_AMOUNT, b.PAYMENT_STATUS,
              m.TITLE, m.POSTER_URL, st.SHOW_DATE, st.START_TIME,
              (SELECT COUNT(*) FROM BOOKING_SEAT bs WHERE bs.BOOKING_ID = b.BOOKING_ID) AS SEAT_COUNT
       FROM BOOKING b
       JOIN SHOWTIME st ON st.SHOWTIME_ID = b.SHOWTIME_ID
       JOIN MOVIE m ON m.MOVIE_ID = st.MOVIE_ID
       WHERE b.USER_ID = :userId
       ORDER BY b.BOOKING_DATE DESC`,
      { userId: req.user.userId }
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch booking history' });
  }
});

// --- Startup ---

const PORT = process.env.PORT || 3000;

async function start() {
  await db.initPool();
  app.listen(PORT, () => {
    console.log(`CineHive API listening on http://localhost:${PORT}`);
  });
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.closePool();
  process.exit(0);
});
