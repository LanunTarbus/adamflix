console.log("ADMIN.JS LOADED");


const loginPage =
    document.getElementById(
        "loginPage"
    );


const adminPage =
    document.getElementById(
        "adminPage"
    );


let allMovies = [];


// ==================================================
// LOGIN CHECK
// ==================================================

async function checkLogin() {

    try {

        const response =
            await fetch(
                "/api/admin/me"
            );


        if (!response.ok) {

            showLogin();

            return;

        }


        const data =
            await response.json();


        if (
            data.authenticated
        ) {

            showAdmin();

        } else {

            showLogin();

        }


    } catch (error) {

        console.error(
            error
        );


        showLogin();

    }

}


// ==================================================
// SHOW LOGIN
// ==================================================

function showLogin() {

    loginPage.style.display =
        "flex";


    adminPage.style.display =
        "none";

}


// ==================================================
// SHOW ADMIN
// ==================================================

function showAdmin() {

    loginPage.style.display =
        "none";


    adminPage.style.display =
        "block";


    loadMovies();

}


// ==================================================
// LOGIN
// ==================================================

document
    .getElementById(
        "loginForm"
    )
    .addEventListener(
        "submit",

        async function (
            event
        ) {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "username"
                    )
                    .value;


            const password =
                document
                    .getElementById(
                        "password"
                    )
                    .value;


            const errorElement =
                document.getElementById(
                    "loginError"
                );


            errorElement.textContent =
                "Logging in...";


            try {

                const response =
                    await fetch(
                        "/api/admin/login",

                        {
                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    username,
                                    password

                                })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    errorElement.textContent =
                        data.error
                        ||
                        "Login failed";


                    return;

                }


                errorElement.textContent =
                    "";


                showAdmin();


            } catch (error) {

                console.error(
                    error
                );


                errorElement.textContent =
                    "Server connection failed";

            }

        }
    );


// ==================================================
// LOGOUT
// ==================================================

document
    .getElementById(
        "logoutButton"
    )
    .addEventListener(
        "click",

        async function () {

            try {

                await fetch(
                    "/api/admin/logout",
                    {
                        method:
                            "POST"
                    }
                );


            } catch (error) {

                console.error(
                    error
                );

            }


            showLogin();

        }
    );


// ==================================================
// LOAD MOVIES
// ==================================================

async function loadMovies() {

    try {

        const response =
            await fetch(
                "/api/movies"
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load movies"
            );

        }


        allMovies =
            await response.json();


        updateStats();


        renderMovies(
            allMovies
        );


    } catch (error) {

        console.error(
            "Load movies error:",
            error
        );

    }

}


// ==================================================
// STATS
// ==================================================

function updateStats() {

    const genres =
        new Set(

            allMovies
                .map(
                    movie =>
                        movie.genre
                )
                .filter(Boolean)

        );


    const totalMovies =
        document.getElementById(
            "totalMovies"
        );


    const totalGenres =
        document.getElementById(
            "totalGenres"
        );


    const latestMovie =
        document.getElementById(
            "latestMovie"
        );


    if (totalMovies) {

        totalMovies.textContent =
            allMovies.length;

    }


    if (totalGenres) {

        totalGenres.textContent =
            genres.size;

    }


    if (latestMovie) {

        latestMovie.textContent =
            allMovies.length
                ? allMovies[0].title
                : "-";

    }

}


// ==================================================
// RENDER MOVIES
// ==================================================

function renderMovies(
    movies
) {

    const container =
        document.getElementById(
            "movieList"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    if (!movies.length) {

        container.innerHTML = `

            <p class="empty-message">
                No movies found.
            </p>

        `;


        return;

    }


    movies.forEach(
        movie => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "admin-movie";


            item.innerHTML = `

                <img
                    src="${movie.poster || ""}"
                    alt="${escapeHtml(movie.title)}"
                >


                <div class="admin-movie-info">

                    <h3>
                        ${escapeHtml(movie.title)}
                    </h3>


                    <p>
                        ${movie.year || ""}
                        •
                        ${escapeHtml(movie.genre || "")}
                        •
                        ⭐ ${movie.rating || ""}
                        •
                        ${escapeHtml(movie.duration || "")}
                    </p>


                    <div class="admin-actions">

                        <a
                            href="/watch.html?id=${movie.id}"
                            target="_blank"
                            class="preview-button"
                        >
                            ▶ Preview
                        </a>


                        <button
                            type="button"
                            class="edit-button"
                            onclick="editMovie(${movie.id})"
                        >
                            ✏ Edit
                        </button>


                        <button
                            type="button"
                            class="delete-button"
                            onclick="deleteMovie(${movie.id})"
                        >
                            Delete
                        </button>

                    </div>

                </div>

            `;


            container.appendChild(
                item
            );

        }
    );

}


// ==================================================
// SEARCH
// ==================================================

const movieSearch =
    document.getElementById(
        "movieSearch"
    );


if (movieSearch) {

    movieSearch.addEventListener(
        "input",

        function () {

            const query =
                this.value
                    .toLowerCase()
                    .trim();


            const filtered =
                allMovies.filter(
                    movie =>

                        String(
                            movie.title || ""
                        )
                            .toLowerCase()
                            .includes(query)

                        ||

                        String(
                            movie.genre || ""
                        )
                            .toLowerCase()
                            .includes(query)

                        ||

                        String(
                            movie.year || ""
                        )
                            .includes(query)

                );


            renderMovies(
                filtered
            );

        }
    );

}


// ==================================================
// GENERATE UPLOAD ID
// ==================================================

function createUploadId() {

    if (
        window.crypto
        &&
        window.crypto.randomUUID
    ) {

        return window.crypto.randomUUID();

    }


    return (

        Date.now()

        +

        "-"

        +

        Math.random()
            .toString(36)
            .slice(2)

    );

}


// ==================================================
// UPLOAD MOVIE
// TWO-STAGE PROGRESS
// ==================================================

const movieForm =
    document.getElementById(
        "movieForm"
    );


if (movieForm) {

    movieForm.addEventListener(
        "submit",

        function (
            event
        ) {

            event.preventDefault();


            const uploadId =
                createUploadId();


            const message =
                document.getElementById(
                    "uploadMessage"
                );


            const panel =
                document.getElementById(
                    "uploadProgressPanel"
                );


            const serverBar =
                document.getElementById(
                    "serverProgressBar"
                );


            const serverText =
                document.getElementById(
                    "serverProgressText"
                );


            const r2Bar =
                document.getElementById(
                    "r2ProgressBar"
                );


            const r2Text =
                document.getElementById(
                    "r2ProgressText"
                );


            const stageMessage =
                document.getElementById(
                    "uploadStageMessage"
                );


            const button =
                document.getElementById(
                    "uploadButton"
                );


            // RESET UI

            if (panel) {

                panel.style.display =
                    "block";

            }


            if (serverBar) {

                serverBar.style.width =
                    "0%";

            }


            if (serverText) {

                serverText.textContent =
                    "0%";

            }


            if (r2Bar) {

                r2Bar.style.width =
                    "0%";

            }


            if (r2Text) {

                r2Text.textContent =
                    "0%";

            }


            if (message) {

                message.textContent =
                    "";

            }


            if (stageMessage) {

                stageMessage.textContent =
                    "Preparing upload...";

            }


            if (button) {

                button.disabled =
                    true;


                button.textContent =
                    "Uploading...";

            }


            const formData =
                new FormData(
                    movieForm
                );


            formData.append(
                "uploadId",
                uploadId
            );


            // ==================================================
            // SSE
            // RAILWAY → R2
            // ==================================================

            let events =
                null;


            try {

                events =
                    new EventSource(

                        `/api/upload-progress/${encodeURIComponent(uploadId)}`

                    );


                events.onmessage =
                    function (
                        event
                    ) {

                        try {

                            const data =
                                JSON.parse(
                                    event.data
                                );


                            if (
                                data.stage ===
                                "r2"
                            ) {

                                const percent =
                                    Math.min(
                                        100,

                                        Math.max(
                                            0,

                                            Number(
                                                data.r2Percent || 0
                                            )
                                        )
                                    );


                                if (r2Bar) {

                                    r2Bar.style.width =
                                        `${percent}%`;

                                }


                                if (r2Text) {

                                    r2Text.textContent =
                                        `${percent}%`;

                                }


                                if (stageMessage) {

                                    stageMessage.textContent =
                                        data.message
                                        ||
                                        "Uploading to Cloudflare R2...";

                                }

                            }


                            if (
                                data.stage ===
                                "done"
                            ) {

                                if (r2Bar) {

                                    r2Bar.style.width =
                                        "100%";

                                }


                                if (r2Text) {

                                    r2Text.textContent =
                                        "100%";

                                }


                                if (stageMessage) {

                                    stageMessage.textContent =
                                        "Finalizing upload...";

                                }


                                events.close();

                            }


                            if (
                                data.stage ===
                                "error"
                            ) {

                                console.error(
                                    "SSE reported upload error:",
                                    data.message
                                );


                                /*
                                 * IMPORTANT:
                                 * Do NOT mark the whole upload
                                 * as failed here.
                                 *
                                 * XHR response remains the
                                 * source of truth.
                                 */


                                if (stageMessage) {

                                    stageMessage.textContent =
                                        data.message
                                        ||
                                        "Finishing upload...";

                                }


                                events.close();

                            }


                        } catch (error) {

                            console.error(
                                "Invalid SSE response:",
                                error
                            );

                        }

                    };


                events.onerror =
                    function (
                        error
                    ) {

                        /*
                         * SSE can disconnect when the
                         * server closes the stream.
                         * This must NOT mean the upload failed.
                         */

                        console.warn(
                            "Upload progress connection closed.",
                            error
                        );


                        if (events) {

                            events.close();

                        }

                    };


            } catch (error) {

                console.warn(
                    "Could not start SSE progress:",
                    error
                );

            }


            // ==================================================
            // XHR
            // BROWSER → RAILWAY
            // ==================================================

            const xhr =
                new XMLHttpRequest();


            xhr.open(
                "POST",
                "/api/movies/upload",
                true
            );


            xhr.upload.addEventListener(
                "progress",

                function (
                    event
                ) {

                    if (
                        !event.lengthComputable
                    ) {

                        return;

                    }


                    const percent =
                        Math.min(
                            100,

                            Math.round(
                                (
                                    event.loaded
                                    /
                                    event.total
                                )
                                *
                                100
                            )
                        );


                    if (serverBar) {

                        serverBar.style.width =
                            `${percent}%`;

                    }


                    if (serverText) {

                        serverText.textContent =
                            `${percent}%`;

                    }


                    if (stageMessage) {

                        if (
                            percent < 100
                        ) {

                            stageMessage.textContent =
                                `Uploading to server... ${percent}%`;

                        } else {

                            stageMessage.textContent =
                                "Server received file. Uploading to Cloudflare R2...";

                        }

                    }

                }
            );


            // ==================================================
            // REAL FINAL RESULT
            // XHR RESPONSE IS SOURCE OF TRUTH
            // ==================================================

            xhr.addEventListener(
                "load",

                async function () {

                    let data = {};


                    try {

                        if (
                            xhr.responseText
                        ) {

                            data =
                                JSON.parse(
                                    xhr.responseText
                                );

                        }

                    } catch (error) {

                        console.error(
                            "Invalid server response:",
                            xhr.responseText
                        );

                    }


                    // Close progress stream

                    if (events) {

                        events.close();

                    }


                    // SESSION EXPIRED

                    if (
                        xhr.status === 401
                    ) {

                        resetUploadButton(
                            button
                        );


                        showLogin();


                        return;

                    }


                    // ==================================================
                    // HTTP ERROR
                    // ==================================================

                    if (
                        xhr.status < 200
                        ||
                        xhr.status >= 300
                    ) {

                        console.error(
                            "Upload failed:",
                            xhr.status,
                            xhr.responseText
                        );


                        if (message) {

                            message.textContent =
                                data.error
                                ||
                                `Upload failed (${xhr.status})`;

                        }


                        if (stageMessage) {

                            stageMessage.textContent =
                                data.error
                                ||
                                "Server failed to save movie";

                        }


                        resetUploadButton(
                            button
                        );


                        return;

                    }


                    // ==================================================
                    // SUCCESS
                    // ==================================================

                    if (serverBar) {

                        serverBar.style.width =
                            "100%";

                    }


                    if (serverText) {

                        serverText.textContent =
                            "100%";

                    }


                    if (r2Bar) {

                        r2Bar.style.width =
                            "100%";

                    }


                    if (r2Text) {

                        r2Text.textContent =
                            "100%";

                    }


                    if (stageMessage) {

                        stageMessage.textContent =
                            "✓ Upload complete";

                    }


                    if (message) {

                        message.textContent =
                            "✓ Movie uploaded successfully";

                    }


                    movieForm.reset();


                    /*
                     * Reload movie list.
                     *
                     * Even if this fails, do NOT
                     * change upload status to failed.
                     */

                    try {

                        await loadMovies();

                    } catch (error) {

                        console.error(
                            "Movie uploaded but list refresh failed:",
                            error
                        );

                    }


                    resetUploadButton(
                        button
                    );


                    setTimeout(
                        function () {

                            if (panel) {

                                panel.style.display =
                                    "none";

                            }


                            if (serverBar) {

                                serverBar.style.width =
                                    "0%";

                            }


                            if (serverText) {

                                serverText.textContent =
                                    "0%";

                            }


                            if (r2Bar) {

                                r2Bar.style.width =
                                    "0%";

                            }


                            if (r2Text) {

                                r2Text.textContent =
                                    "0%";

                            }

                        },

                        2500
                    );

                }
            );


            // ==================================================
            // NETWORK ERROR
            // ==================================================

            xhr.addEventListener(
                "error",

                function () {

                    if (events) {

                        events.close();

                    }


                    if (message) {

                        message.textContent =
                            "Network error";

                    }


                    if (stageMessage) {

                        stageMessage.textContent =
                            "Connection to server failed";

                    }


                    resetUploadButton(
                        button
                    );

                }
            );


            // ==================================================
            // ABORT
            // ==================================================

            xhr.addEventListener(
                "abort",

                function () {

                    if (events) {

                        events.close();

                    }


                    if (message) {

                        message.textContent =
                            "Upload cancelled";

                    }


                    if (stageMessage) {

                        stageMessage.textContent =
                            "Upload cancelled";

                    }


                    resetUploadButton(
                        button
                    );

                }
            );


            // ==================================================
            // TIMEOUT
            // ==================================================

            xhr.addEventListener(
                "timeout",

                function () {

                    if (events) {

                        events.close();

                    }


                    if (message) {

                        message.textContent =
                            "Upload timed out";

                    }


                    if (stageMessage) {

                        stageMessage.textContent =
                            "Server took too long to respond";

                    }


                    resetUploadButton(
                        button
                    );

                }
            );


            /*
             * 0 = no browser-side timeout.
             * Large movie uploads may take a while.
             */

            xhr.timeout =
                0;


            xhr.send(
                formData
            );

        }
    );

}


// ==================================================
// RESET UPLOAD BUTTON
// ==================================================

function resetUploadButton(
    button
) {

    if (!button) {
        return;
    }


    button.disabled =
        false;


    button.textContent =
        "Upload Movie";

}


// ==================================================
// OPEN EDIT
// ==================================================

function editMovie(
    id
) {

    const movie =
        allMovies.find(
            movie =>
                Number(movie.id) ===
                Number(id)
        );


    if (!movie) {

        alert(
            "Movie not found"
        );

        return;

    }


    document
        .getElementById(
            "editMovieId"
        )
        .value =
            movie.id;


    document
        .getElementById(
            "editTitle"
        )
        .value =
            movie.title || "";


    document
        .getElementById(
            "editYear"
        )
        .value =
            movie.year || "";


    document
        .getElementById(
            "editGenre"
        )
        .value =
            movie.genre || "";


    document
        .getElementById(
            "editRating"
        )
        .value =
            movie.rating || "";


    document
        .getElementById(
            "editDuration"
        )
        .value =
            movie.duration || "";


    document
        .getElementById(
            "editDescription"
        )
        .value =
            movie.description || "";


    document
        .getElementById(
            "editPosterPreview"
        )
        .src =
            movie.poster || "";


    document
        .getElementById(
            "editPoster"
        )
        .value =
            "";


    document
        .getElementById(
            "editVideo"
        )
        .value =
            "";


    document
        .getElementById(
            "editMessage"
        )
        .textContent =
            "";


    document
        .getElementById(
            "editModal"
        )
        .style.display =
            "flex";


    document.body.style.overflow =
        "hidden";

}


// ==================================================
// CLOSE EDIT
// ==================================================

function closeEditModal() {

    const modal =
        document.getElementById(
            "editModal"
        );


    if (modal) {

        modal.style.display =
            "none";

    }


    document.body.style.overflow =
        "";

}


document
    .getElementById(
        "closeEditModal"
    )
    .addEventListener(
        "click",
        closeEditModal
    );


document
    .getElementById(
        "cancelEdit"
    )
    .addEventListener(
        "click",
        closeEditModal
    );


document
    .getElementById(
        "editModal"
    )
    .addEventListener(
        "click",

        function (
            event
        ) {

            if (
                event.target ===
                this
            ) {

                closeEditModal();

            }

        }
    );


document.addEventListener(
    "keydown",

    function (
        event
    ) {

        if (
            event.key ===
            "Escape"
        ) {

            closeEditModal();

        }

    }
);


// ==================================================
// NEW POSTER PREVIEW
// ==================================================

document
    .getElementById(
        "editPoster"
    )
    .addEventListener(
        "change",

        function () {

            const file =
                this.files[0];


            if (!file) {
                return;
            }


            const preview =
                document.getElementById(
                    "editPosterPreview"
                );


            preview.src =
                URL.createObjectURL(
                    file
                );

        }
    );


// ==================================================
// SAVE EDIT
// ==================================================

document
    .getElementById(
        "editMovieForm"
    )
    .addEventListener(
        "submit",

        async function (
            event
        ) {

            event.preventDefault();


            const id =
                document
                    .getElementById(
                        "editMovieId"
                    )
                    .value;


            const message =
                document.getElementById(
                    "editMessage"
                );


            const formData =
                new FormData();


            formData.append(
                "title",

                document
                    .getElementById(
                        "editTitle"
                    )
                    .value
                    .trim()
            );


            formData.append(
                "year",

                document
                    .getElementById(
                        "editYear"
                    )
                    .value
            );


            formData.append(
                "genre",

                document
                    .getElementById(
                        "editGenre"
                    )
                    .value
                    .trim()
            );


            formData.append(
                "rating",

                document
                    .getElementById(
                        "editRating"
                    )
                    .value
            );


            formData.append(
                "duration",

                document
                    .getElementById(
                        "editDuration"
                    )
                    .value
                    .trim()
            );


            formData.append(
                "description",

                document
                    .getElementById(
                        "editDescription"
                    )
                    .value
                    .trim()
            );


            const poster =
                document
                    .getElementById(
                        "editPoster"
                    )
                    .files[0];


            const video =
                document
                    .getElementById(
                        "editVideo"
                    )
                    .files[0];


            if (poster) {

                formData.append(
                    "poster",
                    poster
                );

            }


            if (video) {

                formData.append(
                    "video",
                    video
                );

            }


            message.textContent =
                "Saving...";


            try {

                const response =
                    await fetch(
                        `/api/movies/${id}`,

                        {
                            method:
                                "PUT",

                            body:
                                formData
                        }
                    );


                const data =
                    await response.json();


                if (
                    response.status ===
                    401
                ) {

                    closeEditModal();


                    showLogin();


                    return;

                }


                if (!response.ok) {

                    message.textContent =
                        data.error
                        ||
                        "Update failed";


                    return;

                }


                message.textContent =
                    "✓ Movie updated";


                await loadMovies();


                setTimeout(
                    closeEditModal,
                    500
                );


            } catch (error) {

                console.error(
                    error
                );


                message.textContent =
                    "Server connection failed";

            }

        }
    );


// ==================================================
// DELETE MOVIE
// ==================================================

async function deleteMovie(
    id
) {

    const movie =
        allMovies.find(
            movie =>
                Number(movie.id) ===
                Number(id)
        );


    if (!movie) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${movie.title}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/movies/${id}`,

                {
                    method:
                        "DELETE"
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch {
            // ignore
        }


        if (
            response.status ===
            401
        ) {

            showLogin();

            return;

        }


        if (!response.ok) {

            alert(
                data.error
                ||
                "Delete failed"
            );


            return;

        }


        await loadMovies();


    } catch (error) {

        console.error(
            error
        );


        alert(
            "Server connection failed"
        );

    }

}


// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ==================================================
// START
// ==================================================

checkLogin();