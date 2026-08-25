const crypto = require("crypto");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");

const {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const {
    getSignedUrl
} = require("@aws-sdk/s3-request-presigner");

const {
    Upload
} = require("@aws-sdk/lib-storage");


// ==================================================
// LOAD LOCAL .ENV
// Railway uses Variables
// ==================================================

function loadEnv() {

    const envPath =
        path.join(
            __dirname,
            "..",
            ".env"
        );


    if (
        !fs.existsSync(
            envPath
        )
    ) {
        return;
    }


    const lines =
        fs.readFileSync(
            envPath,
            "utf8"
        )
        .split(/\r?\n/);


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
// DATABASE / EXPRESS
// ==================================================

const db =
    require("./database");


const app =
    express();


const PORT =
    process.env.PORT || 3000;


// ==================================================
// ADMIN CONFIG
// ==================================================

const ADMIN_USERNAME =
    process.env.ADMIN_USERNAME;


const ADMIN_PASSWORD_HASH =
    process.env.ADMIN_PASSWORD_HASH;


const ADMIN_PASSWORD_SALT =
    process.env.ADMIN_PASSWORD_SALT;


const SESSION_DURATION =
    1000 * 60 * 60 * 8;


// ==================================================
// CLOUDFLARE R2 CONFIG
// ==================================================

const R2_ACCOUNT_ID =
    process.env.R2_ACCOUNT_ID;


const R2_ACCESS_KEY_ID =
    process.env.R2_ACCESS_KEY_ID;


const R2_SECRET_ACCESS_KEY =
    process.env.R2_SECRET_ACCESS_KEY;


const R2_BUCKET =
    process.env.R2_BUCKET;


const R2_ENDPOINT =
    process.env.R2_ENDPOINT
    ||
    (
        R2_ACCOUNT_ID
            ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : undefined
    );


// Signed URL valid 12 hours

const R2_URL_EXPIRY =
    60 * 60 * 12;


// ==================================================
// R2 CLIENT
// ==================================================

const r2 =
    new S3Client({

        region: "auto",

        endpoint:
            R2_ENDPOINT,

        credentials:
            (
                R2_ACCESS_KEY_ID &&
                R2_SECRET_ACCESS_KEY
            )
                ? {

                    accessKeyId:
                        R2_ACCESS_KEY_ID,

                    secretAccessKey:
                        R2_SECRET_ACCESS_KEY

                }
                : undefined

    });


// ==================================================
// CHECK R2 CONFIG
// ==================================================

function checkR2Config() {

    const missing = [];


    if (!R2_ACCOUNT_ID) {
        missing.push("R2_ACCOUNT_ID");
    }


    if (!R2_ACCESS_KEY_ID) {
        missing.push("R2_ACCESS_KEY_ID");
    }


    if (!R2_SECRET_ACCESS_KEY) {
        missing.push("R2_SECRET_ACCESS_KEY");
    }


    if (!R2_BUCKET) {
        missing.push("R2_BUCKET");
    }


    if (missing.length > 0) {

        throw new Error(
            "Missing R2 variables: "
            +
            missing.join(", ")
        );

    }

}


// ==================================================
// DATA ROOT
// SQLite + compatibility with old files
// ==================================================

const dataRoot =
    process.env.RAILWAY_VOLUME_MOUNT_PATH
    ||
    path.join(
        __dirname,
        ".."
    );


const legacyImagesFolder =
    path.join(
        dataRoot,
        "images"
    );


const legacyMoviesFolder =
    path.join(
        dataRoot,
        "movies"
    );


fs.mkdirSync(
    legacyImagesFolder,
    {
        recursive: true
    }
);


fs.mkdirSync(
    legacyMoviesFolder,
    {
        recursive: true
    }
);


// ==================================================
// TEMP UPLOAD FOLDER
// ==================================================

const tempRoot =
    process.env.TMPDIR
    ||
    process.env.TEMP
    ||
    "/tmp";


const uploadTempFolder =
    path.join(
        tempRoot,
        "adamflix-r2"
    );


fs.mkdirSync(
    uploadTempFolder,
    {
        recursive: true
    }
);


// ==================================================
// EXPRESS MIDDLEWARE
// ==================================================

app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended: true
    })
);


// Static site

app.use(
    express.static(
        path.join(
            __dirname,
            ".."
        )
    )
);


// Legacy Railway volume files

app.use(
    "/images",
    express.static(
        legacyImagesFolder
    )
);


app.use(
    "/movies",
    express.static(
        legacyMoviesFolder
    )
);


// ==================================================
// PASSWORD VERIFY
// ==================================================

function verifyPassword(
    password
) {

    if (
        !password ||
        !ADMIN_PASSWORD_HASH ||
        !ADMIN_PASSWORD_SALT
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
            "Password verify error:",
            error
        );

        return false;

    }

}


// ==================================================
// SESSION
// ==================================================

function createSession(
    username
) {

    const token =
        crypto
            .randomBytes(32)
            .toString("hex");


    const now =
        Date.now();


    const expiresAt =
        now + SESSION_DURATION;


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


function getSessionToken(
    req
) {

    const cookies =
        req.headers.cookie || "";


    const match =
        cookies.match(
            /(?:^|;\s*)admin_session=([^;]+)/
        );


    return match
        ? match[1]
        : null;

}


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
        } =
            req.body;


        if (
            username !== ADMIN_USERNAME
            ||
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


        const cookie = [

            `admin_session=${token}`,

            "HttpOnly",

            "SameSite=Lax",

            "Path=/",

            "Max-Age=28800"

        ];


        if (
            process.env.RAILWAY_ENVIRONMENT
        ) {

            cookie.push(
                "Secure"
            );

        }


        res.setHeader(
            "Set-Cookie",
            cookie.join("; ")
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

            "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
        );


        res.json({

            success: true

        });

    }
);


// ==================================================
// ADMIN ME
// ==================================================

app.get(
    "/api/admin/me",

    requireAdmin,

    (req, res) => {

        res.json({

            authenticated: true,

            username:
                req.admin.username

        });

    }
);


// ==================================================
// SAFE FILENAME
// ==================================================

function safeFilename(
    originalName
) {

    const ext =
        path.extname(
            originalName
        )
        .toLowerCase();


    const base =
        path.basename(
            originalName,
            ext
        )
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .slice(
            0,
            80
        );


    return (

        Date.now()

        +

        "-"

        +

        crypto
            .randomBytes(5)
            .toString("hex")

        +

        "-"

        +

        base

        +

        ext

    );

}


// ==================================================
// R2 KEY
// ==================================================

function createR2Key(
    type,
    originalName
) {

    const filename =
        safeFilename(
            originalName
        );


    if (
        type === "poster"
    ) {

        return (
            `posters/${filename}`
        );

    }


    return (
        `movies/${filename}`
    );

}


// ==================================================
// MULTIPART UPLOAD TO R2
// V22 LARGE FILE SUPPORT
// ==================================================

async function uploadFileToR2(
    localFile,
    type
) {

    checkR2Config();


    const key =
        createR2Key(
            type,
            localFile.originalname
        );


    const stat =
        await fsp.stat(
            localFile.path
        );


    const stream =
        fs.createReadStream(
            localFile.path
        );


    const uploader =
        new Upload({

            client: r2,

            params: {

                Bucket:
                    R2_BUCKET,

                Key:
                    key,

                Body:
                    stream,

                ContentLength:
                    stat.size,

                ContentType:
                    localFile.mimetype
                    ||
                    "application/octet-stream",

                CacheControl:
                    type === "poster"
                        ? "public, max-age=86400"
                        : "private, max-age=3600"

            },


            // 4 parts simultaneously

            queueSize: 4,


            // 10MB per part

            partSize:
                10
                *
                1024
                *
                1024,


            // Remove incomplete parts
            // automatically on failure

            leavePartsOnError:
                false

        });


    let lastPercent =
        -1;


    uploader.on(
        "httpUploadProgress",

        progress => {

            if (
                !progress.total
            ) {
                return;
            }


            const percent =
                Math.round(
                    (
                        progress.loaded
                        /
                        progress.total
                    )
                    *
                    100
                );


            /*
             * Don't flood Railway logs
             * with duplicate percentages.
             */

            if (
                percent !==
                lastPercent
            ) {

                lastPercent =
                    percent;


                console.log(
                    `R2 upload ${type}: ${percent}%`
                );

            }

        }
    );


    console.log(
        `Starting R2 ${type} upload: ${localFile.originalname}`
    );


    console.log(
        `File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`
    );


    await uploader.done();


    console.log(
        `R2 ${type} upload complete: ${key}`
    );


    return key;

}


// ==================================================
// DELETE R2 OBJECT
// ==================================================

async function deleteFromR2(
    key
) {

    if (!key) {
        return;
    }


    checkR2Config();


    await r2.send(
        new DeleteObjectCommand({

            Bucket:
                R2_BUCKET,

            Key:
                key

        })
    );

}


// ==================================================
// SIGN R2 OBJECT
// ==================================================

async function getR2SignedUrl(
    key
) {

    if (!key) {
        return null;
    }


    checkR2Config();


    return await getSignedUrl(

        r2,

        new GetObjectCommand({

            Bucket:
                R2_BUCKET,

            Key:
                key

        }),

        {

            expiresIn:
                R2_URL_EXPIRY

        }

    );

}


// ==================================================
// PUBLIC MOVIE OBJECT
// ==================================================

async function publicMovie(
    movie
) {

    let posterUrl =
        movie.poster;


    let videoUrl =
        movie.video;


    if (
        movie.poster_key
    ) {

        posterUrl =
            await getR2SignedUrl(
                movie.poster_key
            );

    }


    if (
        movie.video_key
    ) {

        videoUrl =
            await getR2SignedUrl(
                movie.video_key
            );

    }


    return {

        ...movie,

        poster:
            posterUrl,

        video:
            videoUrl

    };

}


// ==================================================
// MULTER TEMP STORAGE
// ==================================================

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {

                cb(
                    null,
                    uploadTempFolder
                );

            },


        filename:
            function (
                req,
                file,
                cb
            ) {

                const ext =
                    path.extname(
                        file.originalname
                    );


                cb(

                    null,

                    Date.now()

                    +

                    "-"

                    +

                    crypto
                        .randomBytes(5)
                        .toString("hex")

                    +

                    ext

                );

            }

    });


// ==================================================
// FILE FILTER
// ==================================================

function fileFilter(
    req,
    file,
    cb
) {

    if (
        file.fieldname ===
        "poster"
    ) {

        const allowed = [

            "image/jpeg",

            "image/png",

            "image/webp"

        ];


        if (
            !allowed.includes(
                file.mimetype
            )
        ) {

            return cb(
                new Error(
                    "Poster must be JPG, PNG or WEBP"
                )
            );

        }

    }


    if (
        file.fieldname ===
        "video"
    ) {

        const allowed = [

            "video/mp4",

            "video/webm"

        ];


        if (
            !allowed.includes(
                file.mimetype
            )
        ) {

            return cb(
                new Error(
                    "Video must be MP4 or WEBM"
                )
            );

        }

    }


    cb(
        null,
        true
    );

}


const upload =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                5
                *
                1024
                *
                1024
                *
                1024

        }

    });


// ==================================================
// TEMP FILE CLEANUP
// ==================================================

async function removeTempFile(
    file
) {

    if (
        !file?.path
    ) {
        return;
    }


    try {

        await fsp.unlink(
            file.path
        );

    } catch {
        // ignore
    }

}


async function removeAllTempFiles(
    files
) {

    if (!files) {
        return;
    }


    const allFiles = [

        ...(files.poster || []),

        ...(files.video || [])

    ];


    await Promise.all(
        allFiles.map(
            removeTempFile
        )
    );

}


// ==================================================
// GET ALL MOVIES
// ==================================================

app.get(
    "/api/movies",

    async (
        req,
        res
    ) => {

        try {

            const rows =
                db.prepare(`
                    SELECT *
                    FROM movies
                    ORDER BY id DESC
                `).all();


            const result =
                await Promise.all(

                    rows.map(
                        publicMovie
                    )

                );


            res.json(
                result
            );


        } catch (error) {

            console.error(
                "Load movies error:",
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Failed to load movies"

                });

        }

    }
);


// ==================================================
// GET SINGLE MOVIE
// ==================================================

app.get(
    "/api/movies/:id",

    async (
        req,
        res
    ) => {

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
                await publicMovie(
                    movie
                )
            );


        } catch (error) {

            console.error(
                "Load movie error:",
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Failed to load movie"

                });

        }

    }
);


// ==================================================
// UPLOAD MOVIE
// ==================================================

app.post(
    "/api/movies/upload",

    requireAdmin,

    upload.fields([
        {
            name:
                "poster",

            maxCount:
                1
        },

        {
            name:
                "video",

            maxCount:
                1
        }
    ]),

    async (
        req,
        res
    ) => {

        let posterKey =
            null;


        let videoKey =
            null;


        try {

            const posterFile =
                req.files
                    ?.poster
                    ?.[0];


            const videoFile =
                req.files
                    ?.video
                    ?.[0];


            if (
                !posterFile ||
                !videoFile
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Poster and video are required"

                    });

            }


            const {
                title,
                year,
                genre,
                rating,
                duration,
                description
            } =
                req.body;


            if (
                !title ||
                !String(
                    title
                ).trim()
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Movie title is required"

                    });

            }


            // POSTER

            posterKey =
                await uploadFileToR2(
                    posterFile,
                    "poster"
                );


            // VIDEO MULTIPART

            videoKey =
                await uploadFileToR2(
                    videoFile,
                    "video"
                );


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
                        video,

                        poster_key,
                        video_key
                    )

                    VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?
                    )
                `).run(

                    String(
                        title
                    ).trim(),

                    year,

                    genre,

                    rating,

                    duration,

                    description,

                    null,

                    null,

                    posterKey,

                    videoKey

                );


            res.json({

                success: true,

                id:
                    result.lastInsertRowid

            });


        } catch (error) {

            console.error(
                "Upload movie error:",
                error
            );


            try {

                if (
                    posterKey
                ) {

                    await deleteFromR2(
                        posterKey
                    );

                }


                if (
                    videoKey
                ) {

                    await deleteFromR2(
                        videoKey
                    );

                }

            } catch (
                cleanupError
            ) {

                console.error(
                    "R2 cleanup error:",
                    cleanupError
                );

            }


            res
                .status(500)
                .json({

                    error:
                        error.message
                        ||
                        "Movie upload failed"

                });


        } finally {

            await removeAllTempFiles(
                req.files
            );

        }

    }
);


// ==================================================
// EDIT MOVIE
// ==================================================

app.put(
    "/api/movies/:id",

    requireAdmin,

    upload.fields([
        {
            name:
                "poster",

            maxCount:
                1
        },

        {
            name:
                "video",

            maxCount:
                1
        }
    ]),

    async (
        req,
        res
    ) => {

        let newPosterKey =
            null;


        let newVideoKey =
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

                return res
                    .status(404)
                    .json({

                        error:
                            "Movie not found"

                    });

            }


            const posterFile =
                req.files
                    ?.poster
                    ?.[0];


            const videoFile =
                req.files
                    ?.video
                    ?.[0];


            if (posterFile) {

                newPosterKey =
                    await uploadFileToR2(
                        posterFile,
                        "poster"
                    );

            }


            if (videoFile) {

                newVideoKey =
                    await uploadFileToR2(
                        videoFile,
                        "video"
                    );

            }


            const {
                title,
                year,
                genre,
                rating,
                duration,
                description
            } =
                req.body;


            const finalPosterKey =
                newPosterKey
                ||
                movie.poster_key;


            const finalVideoKey =
                newVideoKey
                ||
                movie.video_key;


            const finalPoster =
                finalPosterKey
                    ? null
                    : movie.poster;


            const finalVideo =
                finalVideoKey
                    ? null
                    : movie.video;


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
                    video = ?,

                    poster_key = ?,
                    video_key = ?

                WHERE id = ?
            `).run(

                title !== undefined
                    ? title
                    : movie.title,

                year !== undefined
                    ? year
                    : movie.year,

                genre !== undefined
                    ? genre
                    : movie.genre,

                rating !== undefined
                    ? rating
                    : movie.rating,

                duration !== undefined
                    ? duration
                    : movie.duration,

                description !== undefined
                    ? description
                    : movie.description,

                finalPoster,

                finalVideo,

                finalPosterKey,

                finalVideoKey,

                req.params.id

            );


            // DELETE OLD R2 POSTER

            if (
                newPosterKey &&
                movie.poster_key
            ) {

                try {

                    await deleteFromR2(
                        movie.poster_key
                    );

                } catch (error) {

                    console.error(
                        "Old poster cleanup failed:",
                        error
                    );

                }

            }


            // DELETE OLD R2 VIDEO

            if (
                newVideoKey &&
                movie.video_key
            ) {

                try {

                    await deleteFromR2(
                        movie.video_key
                    );

                } catch (error) {

                    console.error(
                        "Old video cleanup failed:",
                        error
                    );

                }

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


            try {

                if (
                    newPosterKey
                ) {

                    await deleteFromR2(
                        newPosterKey
                    );

                }


                if (
                    newVideoKey
                ) {

                    await deleteFromR2(
                        newVideoKey
                    );

                }

            } catch (
                cleanupError
            ) {

                console.error(
                    "R2 edit cleanup error:",
                    cleanupError
                );

            }


            res
                .status(500)
                .json({

                    error:
                        error.message
                        ||
                        "Movie update failed"

                });


        } finally {

            await removeAllTempFiles(
                req.files
            );

        }

    }
);


// ==================================================
// DELETE MOVIE
// ==================================================

app.delete(
    "/api/movies/:id",

    requireAdmin,

    async (
        req,
        res
    ) => {

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


            db.prepare(`
                DELETE FROM movies
                WHERE id = ?
            `).run(
                req.params.id
            );


            if (
                movie.poster_key
            ) {

                try {

                    await deleteFromR2(
                        movie.poster_key
                    );

                } catch (error) {

                    console.error(
                        "Poster R2 delete failed:",
                        error
                    );

                }

            }


            if (
                movie.video_key
            ) {

                try {

                    await deleteFromR2(
                        movie.video_key
                    );

                } catch (error) {

                    console.error(
                        "Video R2 delete failed:",
                        error
                    );

                }

            }


            if (
                !movie.poster_key &&
                movie.poster
            ) {

                deleteLegacyFile(
                    movie.poster
                );

            }


            if (
                !movie.video_key &&
                movie.video
            ) {

                deleteLegacyFile(
                    movie.video
                );

            }


            res.json({

                success: true

            });


        } catch (error) {

            console.error(
                "Delete movie error:",
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Failed to delete movie"

                });

        }

    }
);


// ==================================================
// DELETE OLD LOCAL FILE
// ==================================================

function deleteLegacyFile(
    relativePath
) {

    if (!relativePath) {
        return;
    }


    const normalized =
        String(
            relativePath
        )
        .replace(
            /\\/g,
            "/"
        );


    let filePath =
        null;


    if (
        normalized.startsWith(
            "images/"
        )
    ) {

        filePath =
            path.join(
                legacyImagesFolder,
                path.basename(
                    normalized
                )
            );

    }


    if (
        normalized.startsWith(
            "movies/"
        )
    ) {

        filePath =
            path.join(
                legacyMoviesFolder,
                path.basename(
                    normalized
                )
            );

    }


    if (
        filePath &&
        fs.existsSync(
            filePath
        )
    ) {

        try {

            fs.unlinkSync(
                filePath
            );

        } catch (error) {

            console.error(
                "Legacy file cleanup:",
                error
            );

        }

    }

}


// ==================================================
// SESSION CLEANUP
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
                "Session cleanup:",
                error
            );

        }

    },

    1000 * 60 * 30
);


// ==================================================
// ERROR HANDLER
// ==================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "Server error:",
            error
        );


        if (
            error
            instanceof
            multer.MulterError
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    error:
                        error.message

                });

        }


        res
            .status(500)
            .json({

                success: false,

                error:
                    error.message
                    ||
                    "Internal server error"

            });

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


        if (
            R2_ACCOUNT_ID &&
            R2_BUCKET
        ) {

            console.log(
                `Cloudflare R2 enabled: ${R2_BUCKET}`
            );


            console.log(
                "R2 multipart upload enabled"
            );

        } else {

            console.log(
                "Cloudflare R2 is not configured"
            );

        }

    }
);