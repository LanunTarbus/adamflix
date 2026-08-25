const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");


// ==================================================
// DATA ROOT
// Railway = Volume
// Local   = project root
// ==================================================

const dataRoot =
    process.env.RAILWAY_VOLUME_MOUNT_PATH
    ||
    path.join(
        __dirname,
        ".."
    );


// ==================================================
// DATABASE FOLDER
// ==================================================

const databaseFolder =
    path.join(
        dataRoot,
        "database"
    );


fs.mkdirSync(
    databaseFolder,
    {
        recursive: true
    }
);


// ==================================================
// DATABASE
// ==================================================

const dbPath =
    path.join(
        databaseFolder,
        "movies.db"
    );


const db =
    new Database(
        dbPath
    );


db.pragma(
    "foreign_keys = ON"
);


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
// SAFE MIGRATION FOR R2
// Existing movies will NOT be deleted
// ==================================================

const columns =
    db.prepare(
        "PRAGMA table_info(movies)"
    ).all();


const columnNames =
    columns.map(
        column =>
            column.name
    );


if (
    !columnNames.includes(
        "poster_key"
    )
) {

    db.exec(`
        ALTER TABLE movies
        ADD COLUMN poster_key TEXT
    `);

}


if (
    !columnNames.includes(
        "video_key"
    )
) {

    db.exec(`
        ALTER TABLE movies
        ADD COLUMN video_key TEXT
    `);

}


// ==================================================
// ADMIN SESSIONS
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
// EXPORT
// ==================================================

module.exports = db;