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
// ==================================================

function loadEnv() {

    const envPath =
        path.join(
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
// APP / DATABASE
// ==================================================

const db =
    require("./database");


const app =
    express();


const PORT =
    process.env.PORT || 3000;


// ==================================================
// ADMIN
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
// CLOUDFLARE R2
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


const R2_URL_EXPIRY =
    60 * 60 * 12;


// ==================================================
// R2 CLIENT
// ==================================================

const r2 =
    new S3Client({

        region:
            "auto",

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
// CHECK R2
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


    if (missing.length) {

        throw new Error(
            "Missing R2 variables: "
            +
            missing.join(", ")
        );

    }

}


// ==================================================
// DATA ROOT
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
// TEMP UPLOAD
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


app.use(
    express.static(
        path.join(
            __dirname,
            ".."
        )
    )
);


// Legacy local uploads

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
// PASSWORD
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

        const derived =
            crypto.scryptSync(
                password,
                ADMIN_PASSWORD_SALT,
                64
            );


        const stored =
            Buffer.from(
                ADMIN_PASSWORD_HASH,
                "hex"
            );


        if (
            derived.length !==
            stored.length
        ) {

            return false;

        }


        return crypto.timingSafeEqual(
            derived,
            stored
        );


    } catch (error) {

        console.error(
            error
        );


        return false;

    }

}


// ==================================================
// ADMIN SESSION
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

        now + SESSION_DURATION

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
        `).get(
            token
        );


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
        `).run(
            token
        );


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
// LOGIN
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
            username !==
                ADMIN_USERNAME
            ||
            !verifyPassword(
                password
            )
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
            process.env
                .RAILWAY_ENVIRONMENT
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
// LOGOUT
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
            `).run(
                token
            );

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
// TWO-STAGE UPLOAD PROGRESS STORE
// ==================================================

const uploadProgress =
    new Map();


function ensureUploadProgress(
    uploadId
) {

    if (
        !uploadProgress.has(
            uploadId
        )
    ) {

        uploadProgress.set(
            uploadId,
            {

                stage:
                    "waiting",

                r2Percent:
                    0,

                message:
                    "Waiting for upload...",

                updatedAt:
                    Date.now()

            }
        );

    }


    return uploadProgress.get(
        uploadId
    );

}


function setUploadProgress(
    uploadId,
    values
) {

    const current =
        ensureUploadProgress(
            uploadId
        );


    const next = {

        ...current,

        ...values,

        updatedAt:
            Date.now()

    };


    uploadProgress.set(
        uploadId,
        next
    );


    return next;

}


// ==================================================
// SSE R2 PROGRESS
// ==================================================

app.get(
    "/api/upload-progress/:uploadId",

    requireAdmin,

    (req, res) => {

        const uploadId =
            req.params.uploadId;


        ensureUploadProgress(
            uploadId
        );


        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );


        res.setHeader(
            "Cache-Control",
            "no-cache"
        );


        res.setHeader(
            "Connection",
            "keep-alive"
        );


        res.flushHeaders();


        const sendProgress =
            () => {

                const data =
                    uploadProgress.get(
                        uploadId
                    );


                if (!data) {
                    return;
                }


                res.write(
                    `data: ${JSON.stringify(data)}\n\n`
                );


                if (
                    data.stage ===
                        "done"
                    ||
                    data.stage ===
                        "error"
                ) {

                    clearInterval(
                        timer
                    );


                    res.end();

                }

            };


        sendProgress();


        const timer =
            setInterval(
                sendProgress,
                350
            );


        req.on(
            "close",

            () => {

                clearInterval(
                    timer
                );

            }
        );

    }
);


// ==================================================
// CLEAN OLD PROGRESS DATA
// ==================================================

setInterval(
    () => {

        const maxAge =
            1000 * 60 * 30;


        const now =
            Date.now();


        for (
            const [
                id,
                state
            ]
            of uploadProgress
        ) {

            if (
                now -
                state.updatedAt
                >
                maxAge
            ) {

                uploadProgress.delete(
                    id
                );

            }

        }

    },

    1000 * 60 * 5
);


// ==================================================
// SAFE FILE NAME
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
// CREATE R2 KEY
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
        type ===
        "poster"
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
// R2 MULTIPART UPLOAD
// ==================================================

async function uploadFileToR2(
    localFile,
    type,
    onProgress
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

            client:
                r2,

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

            queueSize:
                4,

            partSize:
                10
                *
                1024
                *
                1024,

            leavePartsOnError:
                false

        });


    uploader.on(
        "httpUploadProgress",

        progress => {

            const loaded =
                Number(
                    progress.loaded || 0
                );


            if (
                typeof onProgress ===
                "function"
            ) {

                onProgress(
                    loaded,
                    stat.size
                );

            }

        }
    );


    await uploader.done();


    if (
        typeof onProgress ===
        "function"
    ) {

        onProgress(
            stat.size,
            stat.size
        );

    }


    return {

        key,

        size:
            stat.size

    };

}


// ==================================================
// DELETE R2
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
// SIGNED R2 URL
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
// PUBLIC MOVIE
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
// MULTER
// ==================================================

const storage =
    multer.diskStorage({

        destination(
            req,
            file,
            cb
        ) {

            cb(
                null,
                uploadTempFolder
            );

        },


        filename(
            req,
            file,
            cb
        ) {

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

                path.extname(
                    file.originalname
                )

            );

        }

    });


function fileFilter(
    req,
    file,
    cb
) {

    if (
        file.fieldname ===
        "poster"
    ) {

        if (
            ![
                "image/jpeg",
                "image/png",
                "image/webp"
            ]
            .includes(
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

        if (
            ![
                "video/mp4",
                "video/webm"
            ]
            .includes(
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
// TEMP CLEANUP
// ==================================================

async function removeTempFile(
    file
) {

    if (!file?.path) {
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


    const list = [

        ...(files.poster || []),

        ...(files.video || [])

    ];


    await Promise.all(
        list.map(
            removeTempFile
        )
    );

}


// ==================================================
// GET MOVIES
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


            const movies =
                await Promise.all(
                    rows.map(
                        publicMovie
                    )
                );


            res.json(
                movies
            );


        } catch (error) {

            console.error(
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
// UPLOAD MOVIE WITH TWO STAGES
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

        const uploadId =
            String(
                req.body.uploadId
                ||
                crypto.randomUUID()
            );


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

                throw new Error(
                    "Poster and video are required"
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


            if (
                !title ||
                !String(title).trim()
            ) {

                throw new Error(
                    "Movie title is required"
                );

            }


            const posterStat =
                await fsp.stat(
                    posterFile.path
                );


            const videoStat =
                await fsp.stat(
                    videoFile.path
                );


            const totalCloudBytes =
                posterStat.size
                +
                videoStat.size;


            let posterUploaded =
                0;


            let videoUploaded =
                0;


            function updateOverallR2(
                message
            ) {

                const loaded =
                    posterUploaded
                    +
                    videoUploaded;


                const percent =
                    totalCloudBytes > 0

                        ? Math.min(
                            100,
                            Math.round(
                                (
                                    loaded /
                                    totalCloudBytes
                                )
                                *
                                100
                            )
                        )

                        : 0;


                setUploadProgress(
                    uploadId,
                    {

                        stage:
                            "r2",

                        r2Percent:
                            percent,

                        message

                    }
                );

            }


            setUploadProgress(
                uploadId,
                {

                    stage:
                        "r2",

                    r2Percent:
                        0,

                    message:
                        "Uploading poster to Cloudflare R2..."

                }
            );


            // =========================
            // POSTER → R2
            // =========================

            const posterUpload =
                await uploadFileToR2(

                    posterFile,

                    "poster",

                    loaded => {

                        posterUploaded =
                            loaded;


                        updateOverallR2(
                            "Uploading poster to Cloudflare R2..."
                        );

                    }

                );


            posterKey =
                posterUpload.key;


            posterUploaded =
                posterStat.size;


            updateOverallR2(
                "Uploading movie to Cloudflare R2..."
            );


            // =========================
            // VIDEO → R2
            // =========================

            const videoUpload =
                await uploadFileToR2(

                    videoFile,

                    "video",

                    loaded => {

                        videoUploaded =
                            loaded;


                        updateOverallR2(
                            "Uploading movie to Cloudflare R2..."
                        );

                    }

                );


            videoKey =
                videoUpload.key;


            videoUploaded =
                videoStat.size;


            updateOverallR2(
                "Saving movie to database..."
            );


            // =========================
            // SQLITE
            // =========================

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

                    String(title).trim(),

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


            setUploadProgress(
                uploadId,
                {

                    stage:
                        "done",

                    r2Percent:
                        100,

                    message:
                        "Movie uploaded successfully"

                }
            );


            res.json({

                success: true,

                id:
                    result.lastInsertRowid,

                uploadId

            });


        } catch (error) {

            console.error(
                "Upload movie error:",
                error
            );


            setUploadProgress(
                uploadId,
                {

                    stage:
                        "error",

                    message:
                        error.message
                        ||
                        "Upload failed"

                }
            );


            try {

                if (posterKey) {

                    await deleteFromR2(
                        posterKey
                    );

                }


                if (videoKey) {

                    await deleteFromR2(
                        videoKey
                    );

                }

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
                        error.message
                        ||
                        "Upload failed"

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

                const result =
                    await uploadFileToR2(
                        posterFile,
                        "poster"
                    );


                newPosterKey =
                    result.key;

            }


            if (videoFile) {

                const result =
                    await uploadFileToR2(
                        videoFile,
                        "video"
                    );


                newVideoKey =
                    result.key;

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
                newPosterKey ||
                movie.poster_key;


            const finalVideoKey =
                newVideoKey ||
                movie.video_key;


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

                finalPosterKey
                    ? null
                    : movie.poster,

                finalVideoKey
                    ? null
                    : movie.video,

                finalPosterKey,

                finalVideoKey,

                req.params.id

            );


            if (
                newPosterKey &&
                movie.poster_key
            ) {

                await deleteFromR2(
                    movie.poster_key
                );

            }


            if (
                newVideoKey &&
                movie.video_key
            ) {

                await deleteFromR2(
                    movie.video_key
                );

            }


            res.json({

                success: true

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

            } catch {
                // ignore
            }


            res
                .status(500)
                .json({

                    error:
                        error.message
                        ||
                        "Update failed"

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

                await deleteFromR2(
                    movie.poster_key
                );

            }


            if (
                movie.video_key
            ) {

                await deleteFromR2(
                    movie.video_key
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
                        "Delete failed"

                });

        }

    }
);


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
            error instanceof
            multer.MulterError
        ) {

            return res
                .status(400)
                .json({

                    error:
                        error.message

                });

        }


        res
            .status(500)
            .json({

                error:
                    error.message
                    ||
                    "Internal server error"

            });

    }
);


// ==================================================
// START
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

        }

    }
);