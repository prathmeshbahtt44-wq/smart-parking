// backend/db/database.js

'use strict';

const path = require('path');
const fs   = require('fs');

/* =========================================================
   SQLITE SETUP
========================================================= */

let Database;

try {

  // Node.js 22+ built-in SQLite
  const { DatabaseSync } = require('node:sqlite');

  Database = DatabaseSync;

  console.log('[DB] Using node:sqlite');

} catch (err) {

  console.error('[DB ERROR]');
  console.error('node:sqlite not supported');
  console.error('Use Node.js v22+');

  process.exit(1);
}

/* =========================================================
   DATABASE PATH
========================================================= */

const DB_FOLDER = __dirname;

const DB_PATH = path.join(DB_FOLDER, 'smartpark.db');

if (!fs.existsSync(DB_FOLDER)) {
  fs.mkdirSync(DB_FOLDER, { recursive: true });
}

/* =========================================================
   DATABASE INSTANCE
========================================================= */

let db = null;

function getDb() {

  if (!db) {

    db = new Database(DB_PATH);

    console.log('[DB] Connected →', DB_PATH);
  }

  return db;
}

/* =========================================================
   INITIALIZE DATABASE
========================================================= */

function initDb() {

  const d = getDb();

  try {

    /* ---------- PRAGMA ---------- */

    d.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    /* =====================================================
       USERS TABLE
    ===================================================== */

    d.exec(`
      CREATE TABLE IF NOT EXISTS users (

        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        email TEXT NOT NULL UNIQUE COLLATE NOCASE,

        password TEXT NOT NULL,

        created_at TEXT NOT NULL
      );
    `);

    /* =====================================================
       PARKING LOTS
    ===================================================== */

    d.exec(`
      CREATE TABLE IF NOT EXISTS parking_lots (

        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        location TEXT NOT NULL,

        lat REAL NOT NULL,

        lng REAL NOT NULL,

        total_slots INTEGER NOT NULL,

        price_per_hour INTEGER NOT NULL,

        vehicle_type TEXT NOT NULL
      );
    `);

    /* =====================================================
       SLOTS
    ===================================================== */

    d.exec(`
      CREATE TABLE IF NOT EXISTS slots (

        slot_id TEXT PRIMARY KEY,

        lot_id TEXT NOT NULL,

        slot_number INTEGER NOT NULL,

        is_occupied INTEGER DEFAULT 0,

        booked_by TEXT,

        booking_id TEXT,

        FOREIGN KEY (lot_id)
        REFERENCES parking_lots(id)
      );
    `);

    /* =====================================================
       BOOKINGS
    ===================================================== */

    d.exec(`
      CREATE TABLE IF NOT EXISTS bookings (

        id TEXT PRIMARY KEY,

        user_id TEXT NOT NULL,

        lot_id TEXT NOT NULL,

        lot_name TEXT NOT NULL,

        location TEXT NOT NULL,

        slot_id TEXT NOT NULL,

        slot_number INTEGER NOT NULL,

        vehicle_number TEXT NOT NULL,

        hours INTEGER NOT NULL,

        total_amount INTEGER NOT NULL,

        price_per_hour INTEGER NOT NULL,

        qr_token TEXT NOT NULL,

        status TEXT DEFAULT 'active',

        booked_at TEXT NOT NULL,

        expires_at TEXT NOT NULL,

        cancelled_at TEXT,

        FOREIGN KEY (user_id)
        REFERENCES users(id)
      );
    `);

    /* =====================================================
       AI PARKING SPOTS
    ===================================================== */

    d.exec(`
      CREATE TABLE IF NOT EXISTS ai_spots (

        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        lat REAL NOT NULL,

        lng REAL NOT NULL,

        safety_score INTEGER NOT NULL,

        is_legal INTEGER NOT NULL,

        legal_note TEXT NOT NULL,

        walking_meters INTEGER NOT NULL,

        vehicle_type TEXT NOT NULL,

        surface_type TEXT NOT NULL
      );
    `);

    /* =====================================================
       SEED DATABASE
    ===================================================== */

    seedParkingLots(d);

    seedAiSpots(d);

    console.log('[DB] Database initialized successfully');

  } catch (err) {

    console.error('[DB INIT ERROR]');
    console.error(err);

    process.exit(1);
  }
}

/* =========================================================
   SEED PARKING LOTS
========================================================= */

function seedParkingLots(d) {

  const count = d
    .prepare('SELECT COUNT(*) as count FROM parking_lots')
    .get().count;

  if (count > 0) {
    console.log('[DB] Parking lots already seeded');
    return;
  }

  const lots = [

    ['lot-001','Nariman Point Parking','Nariman Point, Mumbai',18.9256,72.8242,60,40,'Car'],

    ['lot-002','BKC Parking','BKC, Mumbai',19.0596,72.8656,80,60,'Car'],

    ['lot-003','Dadar Station Parking','Dadar, Mumbai',19.0178,72.8432,40,25,'Bike'],

    ['lot-004','Phoenix Mall Parking','Lower Parel',18.9927,72.8256,120,80,'Car'],

    ['lot-005','Andheri Parking','Andheri West',19.1189,72.8367,50,30,'Both']
  ];

  const insertLot = d.prepare(`
    INSERT INTO parking_lots
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const insertSlot = d.prepare(`
    INSERT INTO slots (
      slot_id,
      lot_id,
      slot_number,
      is_occupied
    )
    VALUES (?,?,?,?)
  `);

  d.exec('BEGIN');

  for (const lot of lots) {

    insertLot.run(...lot);

    const [id,,,,,totalSlots] = lot;

    for (let i = 1; i <= totalSlots; i++) {

      insertSlot.run(
        `${id}-S${String(i).padStart(3,'0')}`,
        id,
        i,
        0
      );
    }
  }

  d.exec('COMMIT');

  console.log('[DB] Parking lots seeded');
}

/* =========================================================
   SEED AI SPOTS
========================================================= */

function seedAiSpots(d) {

  const count = d
    .prepare('SELECT COUNT(*) as count FROM ai_spots')
    .get().count;

  if (count > 0) {
    console.log('[DB] AI spots already seeded');
    return;
  }

  const spots = [

    ['ai-001','Nariman Point Spot',18.9240,72.8230,8,1,'Permitted',200,'Car','Paved'],

    ['ai-002','Marine Drive Spot',18.9290,72.8220,9,1,'No restriction',150,'Both','Paved'],

    ['ai-003','BKC Side Street',19.0560,72.8670,7,1,'Weekdays only',400,'Car','Paved']
  ];

  const insertSpot = d.prepare(`
    INSERT INTO ai_spots
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);

  d.exec('BEGIN');

  for (const spot of spots) {
    insertSpot.run(...spot);
  }

  d.exec('COMMIT');

  console.log('[DB] AI spots seeded');
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getDb,
  initDb
};