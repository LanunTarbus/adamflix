console.log("ADMIN.JS LOADED");


const loginPage =
    document.getElementById("loginPage");


const adminPage =
    document.getElementById("adminPage");


let allMovies = [];


// ==================================================
// CHECK LOGIN
// ==================================================

async function checkLogin() {

    try {

        const response =
            await fetch("/api/admin/me");


        if (!response.ok) {

            showLogin();

            return;

        }


        const data =
            await response.json();


        if (data.authenticated) {

            showAdmin();

        } else {

            showLogin();

        }


    } catch (error) {

        console.error(error);

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
    .getElementById("loginForm")
    .addEventListener(
        "submit",

        async function (event) {

            event.preventDefault();


            const username =
                document
                    .getElementById("username")
                    .value;


            const password =
                document
                    .getElementById("password")
                    .value;


            const error =
                document
                    .getElementById("loginError");


            error.textContent =
                "Logging in...";


            try {

                const response =
                    await fetch(
                        "/api/admin/login",
                        {

                            method: "POST",

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

                    error.textContent =
                        data.error ||
                        "Login failed";

                    return;

                }


                error.textContent =
                    "";


                showAdmin();


            } catch (error) {

                console.error(error);


                error.textContent =
                    "Server connection failed";

            }

        }
    );


// ==================================================
// LOGOUT
// ==================================================

document
    .getElementById("logoutButton")
    .addEventListener(
        "click",

        async function () {

            await fetch(
                "/api/admin/logout",
                {
                    method: "POST"
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

        console.error(error);

    }

}


// ==================================================
// STATS
// ==================================================

function updateStats() {

    const total =
        allMovies.length;


    const genres =
        new Set(

            allMovies.map(
                movie =>
                    movie.genre
            )

        );


    const latest =
        allMovies.length > 0

            ? allMovies[0].title

            : "-";


    const totalElement =
        document.getElementById(
            "totalMovies"
        );


    const genreElement =
        document.getElementById(
            "totalGenres"
        );


    const latestElement =
        document.getElementById(
            "latestMovie"
        );


    if (totalElement) {

        totalElement.textContent =
            total;

    }


    if (genreElement) {

        genreElement.textContent =
            genres.size;

    }


    if (latestElement) {

        latestElement.textContent =
            latest;

    }

}


// ==================================================
// RENDER MOVIES
// ==================================================

function renderMovies(movies) {

    const movieList =
        document.getElementById(
            "movieList"
        );


    if (!movieList) {
        return;
    }


    movieList.innerHTML =
        "";


    if (
        movies.length === 0
    ) {

        movieList.innerHTML = `

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


                    <small>

                        Video:
                        ${escapeHtml(movie.video)}

                    </small>


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

                            ✏️ Edit

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


            movieList.appendChild(
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
                            movie.title
                        )
                            .toLowerCase()
                            .includes(query)

                        ||

                        String(
                            movie.genre
                        )
                            .toLowerCase()
                            .includes(query)

                        ||

                        String(
                            movie.year
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
// OPEN EDIT MODAL
// ==================================================

function editMovie(id) {

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


    // Clear old selected files

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
// POSTER PREVIEW WHEN SELECTING NEW POSTER
// ==================================================

document
    .getElementById("editPoster")
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
// CLOSE EDIT MODAL
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


// Close button

document
    .getElementById(
        "closeEditModal"
    )
    .addEventListener(
        "click",
        closeEditModal
    );


// Cancel button

document
    .getElementById(
        "cancelEdit"
    )
    .addEventListener(
        "click",
        closeEditModal
    );


// Click background

document
    .getElementById(
        "editModal"
    )
    .addEventListener(
        "click",

        function (event) {

            if (
                event.target ===
                this
            ) {

                closeEditModal();

            }

        }
    );


// Escape key

document.addEventListener(
    "keydown",

    function (event) {

        if (
            event.key ===
            "Escape"
        ) {

            closeEditModal();

        }

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

        async function (event) {

            event.preventDefault();


            const id =
                document
                    .getElementById(
                        "editMovieId"
                    )
                    .value;


            const title =
                document
                    .getElementById(
                        "editTitle"
                    )
                    .value
                    .trim();


            const year =
                Number(

                    document
                        .getElementById(
                            "editYear"
                        )
                        .value

                );


            const genre =
                document
                    .getElementById(
                        "editGenre"
                    )
                    .value
                    .trim();


            const rating =
                Number(

                    document
                        .getElementById(
                            "editRating"
                        )
                        .value

                );


            const duration =
                document
                    .getElementById(
                        "editDuration"
                    )
                    .value
                    .trim();


            const description =
                document
                    .getElementById(
                        "editDescription"
                    )
                    .value
                    .trim();


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


            const message =
                document
                    .getElementById(
                        "editMessage"
                    );


            // Validation

            if (!title) {

                message.textContent =
                    "Movie title is required.";

                return;

            }


            if (
                !Number.isInteger(year)
                ||
                year < 1888
                ||
                year > 2100
            ) {

                message.textContent =
                    "Enter a valid year.";

                return;

            }


            if (
                !Number.isFinite(rating)
                ||
                rating < 0
                ||
                rating > 10
            ) {

                message.textContent =
                    "Rating must be between 0 and 10.";

                return;

            }


            // Build FormData

            const formData =
                new FormData();


            formData.append(
                "title",
                title
            );


            formData.append(
                "year",
                year
            );


            formData.append(
                "genre",
                genre
            );


            formData.append(
                "rating",
                rating
            );


            formData.append(
                "duration",
                duration
            );


            formData.append(
                "description",
                description
            );


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
                        data.error ||
                        "Update failed";

                    return;

                }


                message.textContent =
                    "✓ Movie updated successfully";


                await loadMovies();


                setTimeout(

                    closeEditModal,

                    600

                );


            } catch (error) {

                console.error(error);


                message.textContent =
                    "Server connection failed";

            }

        }
    );


// ==================================================
// DELETE MOVIE
// ==================================================

async function deleteMovie(id) {

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
                data.error ||
                "Delete failed"
            );

            return;

        }


        await loadMovies();


    } catch (error) {

        console.error(error);


        alert(
            "Server connection failed"
        );

    }

}


// ==================================================
// UPLOAD MOVIE
// ==================================================

const movieForm =
    document.getElementById(
        "movieForm"
    );


if (movieForm) {

    movieForm.addEventListener(
        "submit",

        async function (event) {

            event.preventDefault();


            const message =
                document.getElementById(
                    "uploadMessage"
                );


            const formData =
                new FormData(
                    movieForm
                );


            message.textContent =
                "Uploading...";


            try {

                const response =
                    await fetch(
                        "/api/movies/upload",
                        {

                            method:
                                "POST",

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

                    showLogin();

                    return;

                }


                if (!response.ok) {

                    message.textContent =
                        data.error ||
                        "Upload failed";

                    return;

                }


                message.textContent =
                    "✓ Movie uploaded successfully";


                movieForm.reset();


                await loadMovies();


            } catch (error) {

                console.error(error);


                message.textContent =
                    "Upload failed";

            }

        }
    );

}


// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHtml(value) {

    return String(value)

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