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
// MULTI GENRE
// ==================================================

function parseGenres(
    value
) {

    return String(
        value || ""
    )
        .split(",")
        .map(
            genre =>
                genre.trim()
        )
        .filter(Boolean);

}


function getUploadGenres() {

    return Array
        .from(
            document.querySelectorAll(
                ".upload-genre:checked"
            )
        )
        .map(
            checkbox =>
                checkbox.value
        );

}


function getEditGenres() {

    return Array
        .from(
            document.querySelectorAll(
                ".edit-genre:checked"
            )
        )
        .map(
            checkbox =>
                checkbox.value
        );

}


function setEditGenres(
    genreString
) {

    const selected =
        parseGenres(
            genreString
        );


    document
        .querySelectorAll(
            ".edit-genre"
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    selected.includes(
                        checkbox.value
                    );

            }
        );

}


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
                .flatMap(
                    movie =>
                        parseGenres(
                            movie.genre
                        )
                )

        );


    document
        .getElementById(
            "totalMovies"
        )
        .textContent =
            allMovies.length;


    document
        .getElementById(
            "totalGenres"
        )
        .textContent =
            genres.size;


    document
        .getElementById(
            "latestMovie"
        )
        .textContent =
            allMovies.length
                ? allMovies[0].title
                : "-";

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

document
    .getElementById(
        "movieSearch"
    )
    .addEventListener(
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
// TWO-STAGE PROGRESS + MULTI GENRE
// ==================================================

const movieForm =
    document.getElementById(
        "movieForm"
    );


movieForm.addEventListener(
    "submit",

    function (
        event
    ) {

        event.preventDefault();


        const selectedGenres =
            getUploadGenres();


        if (
            selectedGenres.length === 0
        ) {

            alert(
                "Please select at least one genre."
            );

            return;

        }


        document
            .getElementById(
                "genreValue"
            )
            .value =
                selectedGenres.join(", ");


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


        panel.style.display =
            "block";


        serverBar.style.width =
            "0%";


        serverText.textContent =
            "0%";


        r2Bar.style.width =
            "0%";


        r2Text.textContent =
            "0%";


        message.textContent =
            "";


        stageMessage.textContent =
            "Preparing upload...";


        button.disabled =
            true;


        button.textContent =
            "Uploading...";


        const formData =
            new FormData(
                movieForm
            );


        formData.append(
            "uploadId",
            uploadId
        );


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


                            r2Bar.style.width =
                                `${percent}%`;


                            r2Text.textContent =
                                `${percent}%`;


                            stageMessage.textContent =
                                data.message
                                ||
                                "Uploading to Cloudflare R2...";

                        }


                        if (
                            data.stage ===
                            "done"
                        ) {

                            r2Bar.style.width =
                                "100%";


                            r2Text.textContent =
                                "100%";


                            stageMessage.textContent =
                                "Finalizing upload...";


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


                            stageMessage.textContent =
                                data.message
                                ||
                                "Finishing upload...";


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
                function () {

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


                serverBar.style.width =
                    `${percent}%`;


                serverText.textContent =
                    `${percent}%`;


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
        );


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


                if (events) {

                    events.close();

                }


                if (
                    xhr.status === 401
                ) {

                    resetUploadButton(
                        button
                    );


                    showLogin();


                    return;

                }


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


                    message.textContent =
                        data.error
                        ||
                        `Upload failed (${xhr.status})`;


                    stageMessage.textContent =
                        data.error
                        ||
                        "Server failed to save movie";


                    resetUploadButton(
                        button
                    );


                    return;

                }


                serverBar.style.width =
                    "100%";


                serverText.textContent =
                    "100%";


                r2Bar.style.width =
                    "100%";


                r2Text.textContent =
                    "100%";


                stageMessage.textContent =
                    "✓ Upload complete";


                message.textContent =
                    "✓ Movie uploaded successfully";


                movieForm.reset();


                document
                    .querySelectorAll(
                        ".upload-genre"
                    )
                    .forEach(
                        checkbox => {

                            checkbox.checked =
                                false;

                        }
                    );


                await loadMovies();


                resetUploadButton(
                    button
                );


                setTimeout(
                    function () {

                        panel.style.display =
                            "none";


                        serverBar.style.width =
                            "0%";


                        serverText.textContent =
                            "0%";


                        r2Bar.style.width =
                            "0%";


                        r2Text.textContent =
                            "0%";

                    },

                    2500
                );

            }
        );


        xhr.addEventListener(
            "error",

            function () {

                if (events) {

                    events.close();

                }


                message.textContent =
                    "Network error";


                stageMessage.textContent =
                    "Connection to server failed";


                resetUploadButton(
                    button
                );

            }
        );


        xhr.timeout =
            0;


        xhr.send(
            formData
        );

    }
);


// ==================================================
// RESET UPLOAD BUTTON
// ==================================================

function resetUploadButton(
    button
) {

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


    setEditGenres(
        movie.genre
    );


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

    document
        .getElementById(
            "editModal"
        )
        .style.display =
            "none";


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


            document
                .getElementById(
                    "editPosterPreview"
                )
                .src =
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


            const selectedEditGenres =
                getEditGenres();


            if (
                selectedEditGenres.length === 0
            ) {

                message.textContent =
                    "Please select at least one genre.";

                return;

            }


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

                selectedEditGenres.join(", ")
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


    if (
        !confirm(
            `Delete "${movie.title}"?`
        )
    ) {

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


        const data =
            await response.json();


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
