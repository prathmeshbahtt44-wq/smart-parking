'use strict';

/* ===================================================
   LOCAL STORAGE "BACKEND" — No server needed!
   Replaces all /api/* calls with localStorage logic.
=================================================== */

const DB_USERS_KEY  = 'sp_db_users';
const DB_BOOKINGS_KEY = 'sp_db_bookings';

// ---- Session helpers ----
const getToken  = () => localStorage.getItem('sp_token');
const getUser   = () => { try { return JSON.parse(localStorage.getItem('sp_user') || 'null') } catch { return null } };
const setAuth   = (t, u) => { localStorage.setItem('sp_token', t); localStorage.setItem('sp_user', JSON.stringify(u)); };
const clearAuth = () => { localStorage.removeItem('sp_token'); localStorage.removeItem('sp_user'); };
const isLoggedIn = () => !!getToken();

function requireAuth() { if (!isLoggedIn()) { window.location.href = '/pages/login.html'; return false; } return true; }
function redirectIfAuth() { if (isLoggedIn()) window.location.href = '/pages/dashboard.html'; }

// ---- DB helpers ----
function getUsers() { try { return JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]'); } catch { return []; } }
function saveUsers(u) { localStorage.setItem(DB_USERS_KEY, JSON.stringify(u)); }
function getBookings() { try { return JSON.parse(localStorage.getItem(DB_BOOKINGS_KEY) || '[]'); } catch { return []; } }
function saveBookings(b) { localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(b)); }
function fakeToken(email) { return btoa(email + ':' + Date.now()); }

// ---- Parking Lots (hardcoded, Indian cities) ----
const LOTS = [
  { id:1, name:'Phoenix Mall Parking', location:'Lower Parel, Mumbai', lat:18.9927, lng:72.8256, total:20, booked:18, pricePerHour:60, type:'4-Wheeler', amenities:['CCTV','24x7'] },
  { id:2, name:'BKC P2 Underground', location:'BKC, Mumbai', lat:19.0596, lng:72.8656, total:20, booked:5, pricePerHour:80, type:'4-Wheeler', amenities:['Covered','Security'] },
  { id:3, name:'Dadar Station East', location:'Dadar, Mumbai', lat:19.0178, lng:72.8432, total:20, booked:20, pricePerHour:30, type:'2-Wheeler', amenities:['Open'] },
  { id:4, name:'Connaught Place Block A', location:'CP, Delhi', lat:28.6304, lng:77.2177, total:20, booked:12, pricePerHour:50, type:'Both', amenities:['CCTV'] },
  { id:5, name:'Khan Market Open', location:'Delhi', lat:28.6000, lng:77.2273, total:20, booked:19, pricePerHour:100, type:'4-Wheeler', amenities:['Valet'] },
  { id:6, name:'MG Road Metro Lot', location:'MG Road, Bangalore', lat:12.9716, lng:77.5946, total:20, booked:10, pricePerHour:40, type:'Both', amenities:['EV Charging'] },
  { id:7, name:'UB City Basement', location:'Vittal Mallya Rd, Bangalore', lat:12.9719, lng:77.5959, total:20, booked:15, pricePerHour:120, type:'4-Wheeler', amenities:['Covered','CCTV'] },
  { id:8, name:'Lulu Mall Kochi', location:'Edappally, Kochi', lat:10.0275, lng:76.3082, total:20, booked:8, pricePerHour:30, type:'Both', amenities:['CCTV','24x7'] },
  { id:9, name:'South City Mall', location:'Kolkata', lat:22.5015, lng:88.3619, total:20, booked:14, pricePerHour:40, type:'4-Wheeler', amenities:['Security'] },
  { id:10, name:'Express Avenue', location:'Royapettah, Chennai', lat:13.0587, lng:80.2642, total:20, booked:17, pricePerHour:50, type:'Both', amenities:['CCTV'] },
];

function getLots() {
  // merge any runtime booked counts persisted in localStorage
  const overrides = JSON.parse(localStorage.getItem('sp_lot_overrides') || '{}');
  return LOTS.map(l => ({ ...l, booked: overrides[l.id] !== undefined ? overrides[l.id] : l.booked }));
}
function saveLotBooked(id, count) {
  const o = JSON.parse(localStorage.getItem('sp_lot_overrides') || '{}');
  o[id] = count;
  localStorage.setItem('sp_lot_overrides', JSON.stringify(o));
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---- Auth ----
const Auth = {
  register({ name, email, password }) {
    const users = getUsers();
    if (users.find(u => u.email === email)) throw new Error('Email already registered. Please login.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    const user = { id: Date.now(), name, email, passwordHash: btoa(password), vehicle: '', phone: '', createdAt: new Date().toISOString() };
    users.push(user);
    saveUsers(users);
    const token = fakeToken(email);
    const safeUser = { id: user.id, name: user.name, email: user.email, vehicle: user.vehicle, phone: user.phone };
    return { token, user: safeUser };
  },
  login({ email, password }) {
    const users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) throw new Error('No account found with this email. Please register first.');
    if (user.passwordHash !== btoa(password)) throw new Error('Incorrect password. Please try again.');
    const token = fakeToken(email);
    const safeUser = { id: user.id, name: user.name, email: user.email, vehicle: user.vehicle, phone: user.phone };
    return { token, user: safeUser };
  },
  profile() {
    const u = getUser();
    if (!u) throw new Error('Not logged in');
    return u;
  },
  updateProfile({ vehicle, phone }) {
    let users = getUsers();
    const u = getUser();
    const idx = users.findIndex(x => x.id === u.id);
    if (idx > -1) {
      users[idx].vehicle = vehicle || users[idx].vehicle;
      users[idx].phone   = phone   || users[idx].phone;
      saveUsers(users);
      const updated = { ...u, vehicle: users[idx].vehicle, phone: users[idx].phone };
      localStorage.setItem('sp_user', JSON.stringify(updated));
    }
    return getUser();
  }
};

// ---- Parking ----
const Parking = {
  getAll() { return getLots(); },
  getNearby(lat, lng) {
    return getLots()
      .map(l => ({ ...l, distKm: +haversine(lat, lng, l.lat, l.lng).toFixed(2) }))
      .sort((a, b) => a.distKm - b.distKm);
  },
  getById(id) {
    const lot = getLots().find(l => l.id === +id);
    if (!lot) throw new Error('Lot not found');
    return lot;
  },
  getSlots(id) {
    const lot = getLots().find(l => l.id === +id);
    if (!lot) throw new Error('Lot not found');
    // Return backend-compatible field names: slot_id, slot_number, is_occupied
    let arr = Array.from({ length: lot.total }, (_, i) => ({
      slot_id: `${lot.id}-S${String(i+1).padStart(3,'0')}`,
      slot_number: i + 1,
      is_occupied: i < lot.booked ? 1 : 0
    }));
    // shuffle for realism
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
};

// ---- Bookings ----
const Bookings = {
  book({ lotId, slotId, vehicleNumber, hours }) {
    const lot = getLots().find(l => l.id === +lotId);
    if (!lot) throw new Error('Lot not found');
    if (lot.booked >= lot.total) throw new Error('Lot is full');
    const user = getUser();
    const tok = 'BT-' + Math.random().toString(36).substr(2, 10).toUpperCase();
    // Extract slot number from slot_id like "1-S003" → 3
    const slotNum = slotId ? (parseInt(slotId.split('-S').pop()) || 1) : (lot.booked + 1);
    const booking = {
      id: 'BK-' + Math.random().toString(36).substr(2,6).toUpperCase(),
      lotId: lot.id,
      lotName: lot.name,
      location: lot.location,
      slotId: slotId || `${lot.id}-S${String(lot.booked+1).padStart(3,'0')}`,
      slotNumber: slotNum,
      userId: user.id,
      userEmail: user.email,
      hours: hours || 1,
      totalAmount: (hours || 1) * lot.pricePerHour,
      pricePerHour: lot.pricePerHour,
      status: 'active',
      vehicleNumber: (vehicleNumber || user.vehicle || 'N/A').toUpperCase().trim(),
      bookedAt: new Date().toISOString(),
      token: tok,
    };
    const all = getBookings();
    all.unshift(booking);
    saveBookings(all);
    // Increment booked count
    saveLotBooked(lot.id, lot.booked + 1);
    return booking;
  },
  getMy() {
    const user = getUser();
    if (!user) throw new Error('Not logged in');
    return getBookings().filter(b => b.userId === user.id);
  },
  cancel(id) {
    const all = getBookings();
    const idx = all.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Booking not found');
    all[idx].status = 'cancelled';
    all[idx].cancelledAt = new Date().toISOString();
    saveBookings(all);
    return all[idx];
  }
};

// ---- AI API (Gemini) ----
const GEMINI_API_KEY = "AIzaSyBXXXXX-YOUR-GEMINI-API-KEY-HERE"; // Add your Gemini API key
const AIApi = {
  async fallback(lat, lng, vehicleType) {
    const vt = vehicleType || 'Both';
    const prompt = `I need parking near coordinates (${lat}, ${lng}). Vehicle type: ${vt}. All nearby lots are full. Suggest 3 safe alternative on-street or open-ground parking spots in that area. Return ONLY a valid JSON array, no markdown, no backticks:\n[{"name":"spot name","lat":number,"lng":number,"safety_score":1-10,"is_legal":1or0,"legal_note":"short note","walking_meters":number,"vehicle_type":"Car|Bike|Both","surface_type":"Paved|Concrete|Gravel|Mud"}]\nMake lat/lng realistic offsets from (${lat}, ${lng}) of 0.001-0.006 degrees.`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      let text = data.candidates[0].content.parts[0].text;
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const spots = JSON.parse(text);
      // Compute distanceKm from user location
      return spots.map(s => ({ ...s, distanceKm: Math.round(haversine(lat, lng, s.lat, s.lng) * 10) / 10 }));
    } catch {
      // Fallback mock — uses backend-compatible field names
      return [
        { name: 'Side Street Parking', lat: lat+0.002, lng: lng+0.001, safety_score: 7, is_legal: 1, legal_note: 'No parking restrictions visible', walking_meters: 200, vehicle_type: 'Both', surface_type: 'Paved', distanceKm: 0.3 },
        { name: 'Open Ground Lot', lat: lat-0.003, lng: lng+0.002, safety_score: 5, is_legal: 0, legal_note: 'Informal spot — verify locally', walking_meters: 450, vehicle_type: 'Car', surface_type: 'Gravel', distanceKm: 0.6 },
        { name: 'Residential Lane', lat: lat+0.001, lng: lng-0.002, safety_score: 8, is_legal: 1, legal_note: 'Designated visitor parking', walking_meters: 300, vehicle_type: 'Both', surface_type: 'Concrete', distanceKm: 0.4 },
      ];
    }
  }
};

// ---- UI Utilities ----
function showToast(msg, type = 'info', ms = 3500) {
  let c = document.getElementById('toast-container');
  if (!c) { c = Object.assign(document.createElement('div'), { id: 'toast-container' }); document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = ({ success: '✅', error: '❌', info: 'ℹ️' }[type] || '') + ' ' + msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function fmtIST(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtINR(n) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function availBadge(a, t) { return a / t > 0.3 ? 'bg' : a > 0 ? 'bo' : 'br'; }

function renderNavbar(active = '') {
  const user = getUser();
  const links = [
    { id: 'dashboard', href: '/pages/dashboard.html', label: 'Dashboard' },
    { id: 'map', href: '/pages/map.html', label: 'Find Parking' },
    { id: 'bookings', href: '/pages/bookings.html', label: 'My Bookings' },
    { id: 'ai-finder', href: '/pages/ai-finder.html', label: 'AI Finder' },
    { id: 'camera-scanner', href: '/pages/camera-scanner.html', label: '📷 Scan' },
    { id: 'vehicle-finder', href: '/pages/vehicle-finder.html', label: '🚗 Vehicle' },
  ];
  const el = document.getElementById('navbar-mount');
  if (!el) return;
  el.innerHTML = `<nav class="navbar">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="menu-btn" onclick="document.getElementById('nl').classList.toggle('show')">☰</button>
      <a class="nav-brand" href="/pages/dashboard.html"><span class="logo">🚗</span><span class="nm">SmartPark <em>AI</em></span></a>
    </div>
    <div class="nav-links" id="nl">${links.map(l => '<a class="nav-link' + (active === l.id ? ' active' : '') + '" href="' + l.href + '">' + l.label + '</a>').join('')}</div>
    <div class="nav-right">
      ${user ? '<span style="font-size:13px;color:#64748b" class="hm">Hi, <strong style="color:#fff">' + user.name.split(' ')[0] + '</strong></span>' : ''}
      <button class="btn btn-s btn-sm" onclick="logout()">Logout</button>
    </div>
  </nav>`;
}

function logout() { clearAuth(); showToast('Logged out', 'info', 1200); setTimeout(() => window.location.href = '/pages/login.html', 800); }

function generateQR(token) {
  const seed = [...token].reduce((a, c) => a + c.charCodeAt(0), 0);
  let h = '<div class="qr-grid">';
  for (let i = 0; i < 100; i++) {
    const v = (seed * (i + 1) * 31337) % 97;
    const dk = v < 50 || i < 10 || i > 89 || i % 10 === 0 || i % 10 === 9;
    h += '<div style="aspect-ratio:1;border-radius:1px;background:' + (dk ? '#f97316' : 'rgba(255,255,255,0.05)') + '"></div>';
  }
  return h + '</div>';
}

function btnLoading(btn, text = 'Loading...') { btn.disabled = true; btn._o = btn.innerHTML; btn.innerHTML = '<span class="loader lsm"></span> ' + text; }
function btnReset(btn) { btn.disabled = false; if (btn._o) btn.innerHTML = btn._o; }

// ---- apiFetch shim (not used but kept for compatibility) ----
async function apiFetch(path, opts = {}) {
  console.warn('[apiFetch] Called with path:', path, '— using localStorage backend instead.');
  throw new Error('Direct API calls are disabled. Use Auth/Parking/Bookings objects directly.');
}
