const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");


// ==================================================
// DATABASE FOLDER
// ==================================================

const databaseFolder = path.join(
    __dirname,
    "..",
    "database"
);


// Make sure database folder exists

fs.mkdirSync(
    databaseFolder,
    {
        recursive: true
    }
);


// ==================================================
// DATABASE
// ==================================================

const dbPath = path.join(
    databaseFolder,
    "movies.db"
);


const db =
    new Database(dbPath);


// ==================================================
// MOVIES TABLE
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS movies (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        title TEXT NOT NULL,

        year INTEGER,

        genre TEXT,

        rating REAL,

        duration TEXT,

        description TEXT,

        poster TEXT,

        video TEXT

    )
`);


// ==================================================
// ADMIN SESSIONS TABLE
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (

        token TEXT PRIMARY KEY,

        username TEXT NOT NULL,

        created_at INTEGER NOT NULL,

        expires_at INTEGER NOT NULL

    )
`);


// ==================================================
// EXPORT DATABASE
// ==================================================

module.exports = db;