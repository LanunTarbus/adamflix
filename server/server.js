const crypto = require("crypto");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");


// ==================================================
// LOAD .ENV
// ==================================================

function loadEnv() {

    const envPath = path.join(
        __dirname,
        "..",
        ".env"
    );

    if (!fs.existsSync(envPath)) {
        return;
    }


    const lines =
        fs.readFileSync(
            envPath,
            "utf8"
        ).split(/\r?\n/);


    for (const line of lines) {

        const trimmed =
            line.trim();


        if (
            !trimmed ||
            trimmed.startsWith("#")
        ) {
            continue;
        }


        const index =
            trimmed.indexOf("=");


        if (index === -1) {
            continue;
        }


        const key =
            trimmed
                .slice(0, index)
                .trim();


        let value =
            trimmed
                .slice(index + 1)
                .trim();


        // Remove optional quotes

        if (
            (
                value.startsWith('"') &&
                value.endsWith('"')
            )
            ||
            (
                value.startsWith("'") &&
                value.endsWith("'")
            )
        ) {

            value =
                value.slice(1, -1);

        }


        if (
            key &&
            process.env[key] === undefined
        ) {

            process.env[key] =
                value;

        }

    }

}


loadEnv();


// ==================================================
// MODULES / DATABASE
// ==================================================

const db = require("./database");

const app = express();

// ==================================================
// PORT
// Local     = 3000
// Hosting   = process.env.PORT
// ==================================================

const PORT =
    process.env.PORT || 3000;


// ==================================================
// ADMIN CONFIGURATION
// ==================================================

const ADMIN_USERNAME =
    process.env.ADMIN_USERNAME;

const ADMIN_PASSWORD_HASH =
    process.env.ADMIN_PASSWORD_HASH;

const ADMIN_PASSWORD_SALT =
    process.env.ADMIN_PASSWORD_SALT;


// 8 hours

const SESSION_DURATION =
    1000 * 60 * 60 * 8;


// ==================================================
// FOLDERS
// ==================================================

// ==================================================
// PERSISTENT STORAGE ROOT
// ==================================================

const dataRoot =
    process.env.RAILWAY_VOLUME_MOUNT_PATH
    ||
    path.join(
        __dirname,
        ".."
    );


const imagesFolder =
    path.join(
        dataRoot,
        "images"
    );


const moviesFolder =
    path.join(
        dataRoot,
        "movies"
    );


fs.mkdirSync(
    imagesFolder,
    {
        recursive: true
    }
);


fs.mkdirSync(
    moviesFolder,
    {
        recursive: true
    }
);


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended: true
    })
);


// ==================================================
// STATIC FILES
// ==================================================

app.use(
    express.static(
        path.join(
            __dirname,
            ".."
        )
    )
);

// ==================================================
// SERVE PERSISTENT UPLOADS
// ==================================================

app.use(
    "/images",

    express.static(
        imagesFolder
    )
);


app.use(
    "/movies",

    express.static(
        moviesFolder
    )
);


// ==================================================
// PASSWORD VERIFICATION
// ==================================================

function verifyPassword(password) {

    if (
        !ADMIN_PASSWORD_HASH ||
        !ADMIN_PASSWORD_SALT ||
        !password
    ) {

        return false;

    }


    try {

        const derivedKey =
            crypto.scryptSync(
                password,
                ADMIN_PASSWORD_SALT,
                64
            );


        const storedKey =
            Buffer.from(
                ADMIN_PASSWORD_HASH,
                "hex"
            );


        if (
            derivedKey.length !==
            storedKey.length
        ) {

            return false;

        }


        return crypto.timingSafeEqual(
            derivedKey,
            storedKey
        );


    } catch (error) {

        console.error(
            "Password verification error:",
            error
        );

        return false;

    }

}


// ==================================================
// CREATE SESSION
// ==================================================

function createSession(username) {

    const token =
        crypto
            .randomBytes(32)
            .toString("hex");


    const now =
        Date.now();


    const expiresAt =
        now +
        SESSION_DURATION;


    db.prepare(`
        INSERT INTO admin_sessions
        (
            token,
            username,
            created_at,
            expires_at
        )
        VALUES (?, ?, ?, ?)
    `).run(
        token,
        username,
        now,
        expiresAt
    );


    return token;

}


// ==================================================
// GET SESSION TOKEN
// ==================================================

function getSessionToken(req) {

    const cookies =
        req.headers.cookie || "";


    const match =
        cookies.match(
            /(?:^|;\s*)admin_session=([^;]+)/
        );


    if (!match) {
        return null;
    }


    return match[1];

}


// ==================================================
// REQUIRE ADMIN
// ==================================================

function requireAdmin(
    req,
    res,
    next
) {

    const token =
        getSessionToken(req);


    if (!token) {

        return res
            .status(401)
            .json({

                success: false,

                error:
                    "Authentication required"

            });

    }


    const session =
        db.prepare(`
            SELECT *
            FROM admin_sessions
            WHERE token = ?
        `).get(token);


    if (!session) {

        return res
            .status(401)
            .json({

                success: false,

                error:
                    "Invalid session"

            });

    }


    if (
        Date.now() >
        session.expires_at
    ) {

        db.prepare(`
            DELETE FROM admin_sessions
            WHERE token = ?
        `).run(token);


        return res
            .status(401)
            .json({

                success: false,

                error:
                    "Session expired"

            });

    }


    req.admin =
        session;


    req.adminToken =
        token;


    next();

}


// ==================================================
// ADMIN LOGIN
// ==================================================

app.post(
    "/api/admin/login",

    (req, res) => {

        const {
            username,
            password
        } = req.body;


        if (
            !ADMIN_USERNAME ||
            !ADMIN_PASSWORD_HASH ||
            !ADMIN_PASSWORD_SALT
        ) {

            console.error(
                "Admin authentication is not configured."
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Admin authentication is not configured."

                });

        }


        if (
            username !==
            ADMIN_USERNAME
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "Invalid username or password"

                });

        }


        if (
            !verifyPassword(password)
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "Invalid username or password"

                });

        }


        const token =
            createSession(
                username
            );


        res.setHeader(
            "Set-Cookie",

            [
                `admin_session=${token}`,
                "HttpOnly",
                "SameSite=Lax",
                "Path=/",
                "Max-Age=28800"
            ].join("; ")
        );


        res.json({

            success: true

        });

    }
);


// ==================================================
// ADMIN LOGOUT
// ==================================================

app.post(
    "/api/admin/logout",

    (req, res) => {

        const token =
            getSessionToken(req);


        if (token) {

            db.prepare(`
                DELETE FROM admin_sessions
                WHERE token = ?
            `).run(token);

        }


        res.setHeader(
            "Set-Cookie",

            [
                "admin_session=",
                "HttpOnly",
                "SameSite=Lax",
                "Path=/",
                "Max-Age=0"
            ].join("; ")
        );


        res.json({

            success: true

        });

    }
);


// ==================================================
// CHECK ADMIN SESSION
// ==================================================

app.get(
    "/api/admin/me",

    (req, res) => {

        const token =
            getSessionToken(req);


        if (!token) {

            return res
                .status(401)
                .json({

                    authenticated:
                        false

                });

        }


        const session =
            db.prepare(`
                SELECT *
                FROM admin_sessions
                WHERE token = ?
            `).get(token);


        if (!session) {

            return res
                .status(401)
                .json({

                    authenticated:
                        false

                });

        }


        if (
            Date.now() >
            session.expires_at
        ) {

            db.prepare(`
                DELETE FROM admin_sessions
                WHERE token = ?
            `).run(token);


            return res
                .status(401)
                .json({

                    authenticated:
                        false

                });

        }


        res.json({

            authenticated:
                true,

            username:
                session.username

        });

    }
);


// ==================================================
// CLEAN EXPIRED SESSIONS
// ==================================================

setInterval(
    () => {

        try {

            db.prepare(`
                DELETE FROM admin_sessions
                WHERE expires_at < ?
            `).run(
                Date.now()
            );

        } catch (error) {

            console.error(
                "Session cleanup error:",
                error
            );

        }

    },

    1000 * 60 * 30
);


// ==================================================
// MULTER STORAGE
// ==================================================

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {

                if (
                    file.fieldname ===
                    "poster"
                ) {

                    cb(
                        null,
                        imagesFolder
                    );

                    return;

                }


                if (
                    file.fieldname ===
                    "video"
                ) {

                    cb(
                        null,
                        moviesFolder
                    );

                    return;

                }


                cb(
                    new Error(
                        "Invalid upload field"
                    )
                );

            },


        filename:
            function (
                req,
                file,
                cb
            ) {

                const safeName =
                    file.originalname
                        .replace(
                            /[^a-zA-Z0-9._-]/g,
                            "-"
                        );


                const uniqueName =
                    Date.now() +
                    "-" +
                    crypto
                        .randomBytes(4)
                        .toString("hex") +
                    "-" +
                    safeName;


                cb(
                    null,
                    uniqueName
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {

            fileSize:
                5 *
                1024 *
                1024 *
                1024

        }

    });


// ==================================================
// DELETE FILE HELPER
// ==================================================

function deleteLocalFile(
    relativePath
) {

    if (!relativePath) {
        return;
    }


    const projectRoot =
        path.resolve(
            __dirname,
            ".."
        );


    const filePath =
        path.resolve(
            projectRoot,
            relativePath
        );


    // Prevent deleting outside project

    if (
        !filePath.startsWith(
            projectRoot +
            path.sep
        )
    ) {

        console.error(
            "Blocked invalid file path:",
            filePath
        );

        return;

    }


    if (
        fs.existsSync(
            filePath
        )
    ) {

        fs.unlinkSync(
            filePath
        );

    }

}


// ==================================================
// GET ALL MOVIES
// ==================================================

app.get(
    "/api/movies",

    (req, res) => {

        try {

            const movies =
                db.prepare(`
                    SELECT *
                    FROM movies
                    ORDER BY id DESC
                `).all();


            res.json(
                movies
            );


        } catch (error) {

            console.error(error);


            res
                .status(500)
                .json({

                    error:
                        "Failed to load movies."

                });

        }

    }
);


// ==================================================
// GET SINGLE MOVIE
// ==================================================

app.get(
    "/api/movies/:id",

    (req, res) => {

        try {

            const movie =
                db.prepare(`
                    SELECT *
                    FROM movies
                    WHERE id = ?
                `).get(
                    req.params.id
                );


            if (!movie) {

                return res
                    .status(404)
                    .json({

                        error:
                            "Movie not found"

                    });

            }


            res.json(
                movie
            );


        } catch (error) {

            console.error(error);


            res
                .status(500)
                .json({

                    error:
                        "Failed to load movie."

                });

        }

    }
);


// ==================================================
// UPLOAD MOVIE
// ADMIN ONLY
// ==================================================

app.post(
    "/api/movies/upload",

    requireAdmin,

    upload.fields([
        {
            name: "poster",
            maxCount: 1
        },
        {
            name: "video",
            maxCount: 1
        }
    ]),

    (req, res) => {

        let posterPath = null;
        let videoPath = null;


        try {

            const {
                title,
                year,
                genre,
                rating,
                duration,
                description
            } = req.body;


            if (
                !title ||
                !genre
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Title and genre are required."

                    });

            }


            if (
                !req.files ||
                !req.files.poster ||
                !req.files.video
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Poster and video are required."

                    });

            }


            posterPath =
                "images/" +
                req.files.poster[0]
                    .filename;


            videoPath =
                "movies/" +
                req.files.video[0]
                    .filename;


            const result =
                db.prepare(`

                    INSERT INTO movies
                    (
                        title,
                        year,
                        genre,
                        rating,
                        duration,
                        description,
                        poster,
                        video
                    )

                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)

                `).run(

                    title.trim(),

                    year,

                    genre.trim(),

                    rating,

                    duration,

                    description,

                    posterPath,

                    videoPath

                );


            res.json({

                success: true,

                id:
                    result.lastInsertRowid

            });


        } catch (error) {

            console.error(
                error
            );


            // Remove uploaded files
            // if DB insert fails

            try {

                deleteLocalFile(
                    posterPath
                );

                deleteLocalFile(
                    videoPath
                );

            } catch (
                cleanupError
            ) {

                console.error(
                    cleanupError
                );

            }


            res
                .status(500)
                .json({

                    error:
                        "Failed to upload movie."

                });

        }

    }
);


// ==================================================
// EDIT MOVIE
// ADMIN ONLY
//
// Metadata + optional poster/video replacement
// ==================================================

app.put(
    "/api/movies/:id",

    requireAdmin,

    upload.fields([
        {
            name: "poster",
            maxCount: 1
        },
        {
            name: "video",
            maxCount: 1
        }
    ]),

    (req, res) => {

        let uploadedPosterPath =
            null;

        let uploadedVideoPath =
            null;


        try {

            const movie =
                db.prepare(`
                    SELECT *
                    FROM movies
                    WHERE id = ?
                `).get(
                    req.params.id
                );


            if (!movie) {

                // Delete files Multer may
                // already have uploaded

                if (
                    req.files?.poster?.[0]
                ) {

                    uploadedPosterPath =
                        "images/" +
                        req.files.poster[0]
                            .filename;


                    deleteLocalFile(
                        uploadedPosterPath
                    );

                }


                if (
                    req.files?.video?.[0]
                ) {

                    uploadedVideoPath =
                        "movies/" +
                        req.files.video[0]
                            .filename;


                    deleteLocalFile(
                        uploadedVideoPath
                    );

                }


                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "Movie not found"

                    });

            }


            const {
                title,
                year,
                genre,
                rating,
                duration,
                description
            } = req.body;


            const newTitle =
                title !== undefined
                    ? String(title).trim()
                    : movie.title;


            const newYear =
                year !== undefined
                    ? year
                    : movie.year;


            const newGenre =
                genre !== undefined
                    ? String(genre).trim()
                    : movie.genre;


            const newRating =
                rating !== undefined
                    ? rating
                    : movie.rating;


            const newDuration =
                duration !== undefined
                    ? duration
                    : movie.duration;


            const newDescription =
                description !== undefined
                    ? description
                    : movie.description;


            if (!newTitle) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Movie title is required."

                    });

            }


            if (!newGenre) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Genre is required."

                    });

            }


            let newPosterPath =
                movie.poster;


            let newVideoPath =
                movie.video;


            // New poster

            if (
                req.files?.poster?.[0]
            ) {

                uploadedPosterPath =
                    "images/" +
                    req.files.poster[0]
                        .filename;


                newPosterPath =
                    uploadedPosterPath;

            }


            // New video

            if (
                req.files?.video?.[0]
            ) {

                uploadedVideoPath =
                    "movies/" +
                    req.files.video[0]
                        .filename;


                newVideoPath =
                    uploadedVideoPath;

            }


            // Update database first

            db.prepare(`
                UPDATE movies

                SET
                    title = ?,
                    year = ?,
                    genre = ?,
                    rating = ?,
                    duration = ?,
                    description = ?,
                    poster = ?,
                    video = ?

                WHERE id = ?
            `).run(

                newTitle,

                newYear,

                newGenre,

                newRating,

                newDuration,

                newDescription,

                newPosterPath,

                newVideoPath,

                req.params.id

            );


            // Only delete old files
            // AFTER database update succeeds

            if (
                uploadedPosterPath &&
                movie.poster &&
                movie.poster !==
                    newPosterPath
            ) {

                deleteLocalFile(
                    movie.poster
                );

            }


            if (
                uploadedVideoPath &&
                movie.video &&
                movie.video !==
                    newVideoPath
            ) {

                deleteLocalFile(
                    movie.video
                );

            }


            res.json({

                success: true,

                message:
                    "Movie updated successfully"

            });


        } catch (error) {

            console.error(
                "Edit movie error:",
                error
            );


            // DB update failed:
            // remove newly uploaded files,
            // preserve old files.

            try {

                if (
                    uploadedPosterPath
                ) {

                    deleteLocalFile(
                        uploadedPosterPath
                    );

                }


                if (
                    uploadedVideoPath
                ) {

                    deleteLocalFile(
                        uploadedVideoPath
                    );

                }

            } catch (
                cleanupError
            ) {

                console.error(
                    "Edit cleanup error:",
                    cleanupError
                );

            }


            res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Failed to update movie."

                });

        }

    }
);


// ==================================================
// DELETE MOVIE
// ADMIN ONLY
// ==================================================

app.delete(
    "/api/movies/:id",

    requireAdmin,

    (req, res) => {

        try {

            const movie =
                db.prepare(`
                    SELECT *
                    FROM movies
                    WHERE id = ?
                `).get(
                    req.params.id
                );


            if (!movie) {

                return res
                    .status(404)
                    .json({

                        error:
                            "Movie not found"

                    });

            }


            // Delete DB record first

            db.prepare(`
                DELETE FROM movies
                WHERE id = ?
            `).run(
                req.params.id
            );


            // Then delete files

            try {

                deleteLocalFile(
                    movie.poster
                );


                deleteLocalFile(
                    movie.video
                );


            } catch (
                fileError
            ) {

                console.error(
                    "Movie deleted from DB, but file cleanup failed:",
                    fileError
                );

            }


            res.json({

                success: true

            });


        } catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Failed to delete movie."

                });

        }

    }
);


// ==================================================
// MULTER ERROR HANDLER
// ==================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        if (
            error instanceof
            multer.MulterError
        ) {

            console.error(
                "Multer error:",
                error
            );


            return res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }


        if (error) {

            console.error(
                "Server error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Server error"

                });

        }


        next();

    }
);


// ==================================================
// START SERVER
// ==================================================

app.listen(
    PORT,
    () => {

        console.log(
            `AdamFlix running at http://localhost:${PORT}`
        );

    }
);