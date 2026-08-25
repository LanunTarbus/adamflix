console.log(
    "ADMIN.JS LOADED"
);


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

        async event => {

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

        async () => {

            await fetch(
                "/api/admin/logout",
                {
                    method:
                        "POST"
                }
            );


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
                    src="${movie.poster}"
                    alt="${escapeHtml(movie.title)}"
                >


                <div class="admin-movie-info">

                    <h3>
                        ${escapeHtml(movie.title)}
                    </h3>


                    <p>
                        ${movie.year}
                        •
                        ${escapeHtml(movie.genre)}
                        •
                        ⭐ ${movie.rating}
                        •
                        ${escapeHtml(movie.duration)}
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
                            class="edit-button"
                            onclick="editMovie(${movie.id})"
                        >
                            ✏ Edit
                        </button>


                        <button
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
        window.crypto &&
        crypto.randomUUID
    ) {

        return crypto.randomUUID();

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
// TWO STAGE UPLOAD
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


        // ==================================================
        // SSE - R2 PROGRESS
        // ==================================================

        const events =
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
                            Number(
                                data.r2Percent || 0
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
                            "✓ Upload complete";


                        events.close();

                    }


                    if (
                        data.stage ===
                        "error"
                    ) {

                        stageMessage.textContent =
                            data.message
                            ||
                            "Upload failed";


                        events.close();

                    }


                } catch (error) {

                    console.error(
                        error
                    );

                }

            };


        // ==================================================
        // XHR - BROWSER → RAILWAY
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


                serverBar.style.width =
                    `${percent}%`;


                serverText.textContent =
                    `${percent}%`;


                stageMessage.textContent =
                    `Uploading to server... ${percent}%`;


                if (
                    percent >= 100
                ) {

                    stageMessage.textContent =
                        "Server received file. Sending to Cloudflare R2...";

                }

            }
        );


        xhr.addEventListener(
            "load",

            async function () {

                let data = {};


                try {

                    data =
                        JSON.parse(
                            xhr.responseText
                        );

                } catch {
                    // ignore
                }


                if (
                    xhr.status === 401
                ) {

                    events.close();

                    button.disabled =
                        false;


                    button.textContent =
                        "Upload Movie";


                    showLogin();


                    return;

                }


                if (
                    xhr.status < 200 ||
                    xhr.status >= 300
                ) {

                    events.close();


                    stageMessage.textContent =
                        data.error
                        ||
                        "Upload failed";


                    message.textContent =
                        "Upload failed";


                    button.disabled =
                        false;


                    button.textContent =
                        "Upload Movie";


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
                    "✓ Movie uploaded successfully";


                message.textContent =
                    "✓ Movie uploaded successfully";


                movieForm.reset();


                await loadMovies();


                button.disabled =
                    false;


                button.textContent =
                    "Upload Movie";


                setTimeout(
                    function () {

                        panel.style.display =
                            "none";


                        serverBar.style.width =
                            "0%";


                        r2Bar.style.width =
                            "0%";

                    },

                    2500
                );

            }
        );


        xhr.addEventListener(
            "error",

            function () {

                events.close();


                message.textContent =
                    "Network error";


                stageMessage.textContent =
                    "Upload failed";


                button.disabled =
                    false;


                button.textContent =
                    "Upload Movie";

            }
        );


        xhr.send(
            formData
        );

    }
);


// ==================================================
// EDIT
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

        async event => {

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
// DELETE
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
// ESCAPE
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