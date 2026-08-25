let movies = [];

let selectedGenre =
    "All";


// ==================================================
// ELEMENTS
// ==================================================

const latestContainer =
    document.getElementById(
        "latestMovies"
    );


const trendingContainer =
    document.getElementById(
        "trendingMovies"
    );


const continueContainer =
    document.getElementById(
        "continueMovies"
    );


const myListContainer =
    document.getElementById(
        "myListMovies"
    );


const searchResults =
    document.getElementById(
        "searchResults"
    );


const searchSection =
    document.getElementById(
        "searchSection"
    );


const searchEmpty =
    document.getElementById(
        "searchEmpty"
    );


const searchInput =
    document.getElementById(
        "searchInput"
    );


const navSearch =
    document.getElementById(
        "navSearch"
    );


const mobileSearch =
    document.getElementById(
        "mobileSearch"
    );


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


function movieHasGenre(
    movie,
    genre
) {

    if (
        genre === "All"
    ) {

        return true;

    }


    return parseGenres(
        movie.genre
    )
        .some(
            item =>
                item.toLowerCase() ===
                genre.toLowerCase()
        );

}


// ==================================================
// SKELETONS
// ==================================================

function createSkeletonCard() {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "movie-card skeleton-card";


    card.innerHTML = `

        <div
            class="poster-wrapper skeleton-box"
        ></div>

        <div class="movie-card-info">

            <div
                class="skeleton-line skeleton-title"
            ></div>

            <div
                class="skeleton-line skeleton-small"
            ></div>

        </div>

    `;


    return card;

}


function showSkeletons() {

    const containers = [

        latestContainer,
        trendingContainer

    ];


    containers.forEach(
        container => {

            if (!container) {
                return;
            }


            container.innerHTML =
                "";


            for (
                let i = 0;
                i < 7;
                i++
            ) {

                container.appendChild(
                    createSkeletonCard()
                );

            }

        }
    );

}


// ==================================================
// LOAD MOVIES
// ==================================================

async function loadMovies() {

    showSkeletons();


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


        movies =
            await response.json();


        setupHero();

        renderGenres();

        renderLatest();

        renderTrending();

        renderContinueWatching();

        renderMyList();


    } catch (error) {

        console.error(error);


        latestContainer.innerHTML = `

            <div class="empty-state">

                <h3>
                    Unable to load movies
                </h3>

                <p>
                    Please refresh the page.
                </p>

            </div>

        `;

    }

}


// ==================================================
// HERO
// ==================================================

function setupHero() {

    if (
        movies.length === 0
    ) {

        document.getElementById(
            "heroTitle"
        ).textContent =
            "No movies yet";


        document.getElementById(
            "heroDescription"
        ).textContent =
            "Upload a movie from the admin panel.";


        return;

    }


    const movie =
        movies[0];


    document.getElementById(
        "heroTitle"
    ).textContent =
        movie.title;


    document.getElementById(
        "heroDescription"
    ).textContent =
        movie.description || "";


    document.getElementById(
        "heroMeta"
    ).innerHTML = `

        <span>
            ⭐ ${movie.rating}
        </span>

        <span>
            ${movie.year}
        </span>

        <span>
            ${escapeHtml(movie.genre)}
        </span>

        <span>
            ${escapeHtml(movie.duration)}
        </span>

    `;


    document.getElementById(
        "heroBackdrop"
    ).style.backgroundImage =
        `url("${movie.poster}")`;


    document.getElementById(
        "heroWatchButton"
    ).onclick =
        function () {

            window.location.href =
                `/watch.html?id=${movie.id}`;

        };


    document.getElementById(
        "heroInfoButton"
    ).onclick =
        function () {

            window.location.href =
                `/movie.html?id=${movie.id}`;

        };

}


// ==================================================
// GENRES
// ==================================================

function renderGenres() {

    const genreSection =
        document.getElementById(
            "genreSection"
        );


    const genres =
        [
            ...new Set(

                movies
                    .flatMap(
                        movie =>
                            parseGenres(
                                movie.genre
                            )
                    )

            )
        ]
        .sort();


    genreSection.innerHTML = `

        <button
            class="genre-button active"
            data-genre="All"
            type="button"
        >
            All
        </button>

    `;


    genres.forEach(
        genre => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "genre-button";


            button.type =
                "button";


            button.dataset.genre =
                genre;


            button.textContent =
                genre;


            genreSection.appendChild(
                button
            );

        }
    );


    genreSection
        .querySelectorAll(
            ".genre-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",

                    function () {

                        genreSection
                            .querySelectorAll(
                                ".genre-button"
                            )
                            .forEach(
                                btn =>
                                    btn.classList.remove(
                                        "active"
                                    )
                            );


                        this.classList.add(
                            "active"
                        );


                        selectedGenre =
                            this.dataset.genre;


                        performSearch(
                            searchInput.value
                        );

                    }
                );

            }
        );

}


// ==================================================
// MOVIE CARD
// ==================================================

function createMovieCard(
    movie,
    options = {}
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "movie-card polished-card";


    card.innerHTML = `

        <div class="poster-wrapper">

            <img
                src="${movie.poster}"
                alt="${escapeHtml(movie.title)}"
                loading="lazy"
            >


            <div class="poster-gradient"></div>


            <div class="poster-overlay">

                <button
                    type="button"
                    class="card-play-button"
                    aria-label="Watch ${escapeHtml(movie.title)}"
                >
                    ▶
                </button>

            </div>


            ${
                options.progress !== undefined

                    ? `

                        <div class="home-progress-track">

                            <div
                                class="home-progress-fill"
                                style="
                                    width:
                                    ${Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            options.progress
                                        )
                                    )}%;
                                "
                            ></div>

                        </div>

                    `

                    : ""
            }

        </div>


        <div class="movie-card-info">

            <h3>
                ${escapeHtml(movie.title)}
            </h3>


            <div class="card-meta">

                <span>
                    ${movie.year}
                </span>

                <span>
                    ${escapeHtml(movie.genre)}
                </span>

                <span>
                    ⭐ ${movie.rating}
                </span>

            </div>

        </div>

    `;


    card.addEventListener(
        "click",

        function () {

            window.location.href =
                `/movie.html?id=${movie.id}`;

        }
    );


    const playButton =
        card.querySelector(
            ".card-play-button"
        );


    playButton.addEventListener(
        "click",

        function (event) {

            event.stopPropagation();


            window.location.href =
                `/watch.html?id=${movie.id}`;

        }
    );


    return card;

}


// ==================================================
// LATEST
// ==================================================

function renderLatest() {

    latestContainer.innerHTML =
        "";


    movies
        .slice(
            0,
            15
        )
        .forEach(
            movie => {

                latestContainer.appendChild(
                    createMovieCard(
                        movie
                    )
                );

            }
        );

}


// ==================================================
// TRENDING
// ==================================================

function renderTrending() {

    trendingContainer.innerHTML =
        "";


    const trending =
        [...movies]
            .sort(
                (a, b) =>

                    Number(
                        b.rating || 0
                    )
                    -
                    Number(
                        a.rating || 0
                    )
            )
            .slice(
                0,
                15
            );


    trending.forEach(
        movie => {

            trendingContainer.appendChild(
                createMovieCard(
                    movie
                )
            );

        }
    );

}


// ==================================================
// CONTINUE WATCHING
// ==================================================

function renderContinueWatching() {

    continueContainer.innerHTML =
        "";


    const watched =
        movies
            .map(
                movie => {

                    const saved =
                        localStorage.getItem(
                            `movie-progress-${movie.id}`
                        );


                    if (!saved) {

                        return null;

                    }


                    try {

                        const progress =
                            JSON.parse(
                                saved
                            );


                        if (
                            progress.currentTime <= 5
                            ||
                            progress.percent >= 95
                        ) {

                            return null;

                        }


                        return {

                            movie,

                            progress:
                                progress.percent

                        };


                    } catch {

                        return null;

                    }

                }
            )
            .filter(Boolean);


    if (
        watched.length === 0
    ) {

        document.getElementById(
            "continueSection"
        ).style.display =
            "none";


        return;

    }


    document.getElementById(
        "continueSection"
    ).style.display =
        "block";


    watched.forEach(
        item => {

            continueContainer.appendChild(

                createMovieCard(
                    item.movie,
                    {
                        progress:
                            item.progress
                    }
                )

            );

        }
    );

}


// ==================================================
// MY LIST
// ==================================================

function getMyList() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "adamflix-my-list"
            )
        ) || [];

    } catch {

        return [];

    }

}


function renderMyList() {

    myListContainer.innerHTML =
        "";


    const list =
        getMyList();


    const myMovies =
        movies.filter(
            movie =>

                list.includes(
                    Number(movie.id)
                )
        );


    if (
        myMovies.length === 0
    ) {

        document.getElementById(
            "myListSection"
        ).style.display =
            "none";


        return;

    }


    document.getElementById(
        "myListSection"
    ).style.display =
        "block";


    myMovies.forEach(
        movie => {

            myListContainer.appendChild(
                createMovieCard(
                    movie
                )
            );

        }
    );

}


// ==================================================
// SEARCH
// ==================================================

function performSearch(
    query
) {

    const text =
        String(
            query || ""
        )
            .toLowerCase()
            .trim();


    if (
        text === ""
        &&
        selectedGenre === "All"
    ) {

        searchSection.classList.add(
            "hidden"
        );


        return;

    }


    const results =
        movies.filter(
            movie => {

                const title =
                    String(
                        movie.title || ""
                    )
                        .toLowerCase();


                const genre =
                    String(
                        movie.genre || ""
                    )
                        .toLowerCase();


                const matchesText =
                    text === ""
                    ||
                    title.includes(
                        text
                    )
                    ||
                    genre.includes(
                        text
                    );


                const matchesGenre =
                    movieHasGenre(
                        movie,
                        selectedGenre
                    );


                return (
                    matchesText
                    &&
                    matchesGenre
                );

            }
        );


    renderSearchResults(
        results
    );

}


// ==================================================
// SEARCH RESULTS
// ==================================================

function renderSearchResults(
    results
) {

    searchSection.classList.remove(
        "hidden"
    );


    searchResults.innerHTML =
        "";


    if (
        results.length === 0
    ) {

        searchEmpty.style.display =
            "block";


        return;

    }


    searchEmpty.style.display =
        "none";


    results.forEach(
        movie => {

            searchResults.appendChild(
                createMovieCard(
                    movie
                )
            );

        }
    );

}


// ==================================================
// SEARCH INPUT SYNC
// ==================================================

function syncSearch(
    value
) {

    searchInput.value =
        value;


    navSearch.value =
        value;


    mobileSearch.value =
        value;


    performSearch(
        value
    );

}


searchInput.addEventListener(
    "input",

    function () {

        syncSearch(
            this.value
        );

    }
);


navSearch.addEventListener(
    "input",

    function () {

        syncSearch(
            this.value
        );

    }
);


mobileSearch.addEventListener(
    "input",

    function () {

        syncSearch(
            this.value
        );

    }
);


// ==================================================
// CLEAR SEARCH
// ==================================================

document
    .getElementById(
        "clearSearchButton"
    )
    .addEventListener(
        "click",

        function () {

            selectedGenre =
                "All";


            document
                .querySelectorAll(
                    ".genre-button"
                )
                .forEach(
                    button => {

                        button
                            .classList
                            .toggle(
                                "active",

                                button
                                    .dataset
                                    .genre ===
                                    "All"
                            );

                    }
                );


            syncSearch(
                ""
            );


            searchSection.classList.add(
                "hidden"
            );

        }
    );


// ==================================================
// MOBILE MENU
// ==================================================

const mobileMenu =
    document.getElementById(
        "mobileMenu"
    );


document
    .getElementById(
        "mobileMenuButton"
    )
    .addEventListener(
        "click",

        function () {

            mobileMenu.classList.toggle(
                "open"
            );

        }
    );


mobileMenu
    .querySelectorAll(
        "a"
    )
    .forEach(
        link => {

            link.addEventListener(
                "click",

                function () {

                    mobileMenu.classList.remove(
                        "open"
                    );

                }
            );

        }
    );


// ==================================================
// MOBILE SEARCH PANEL
// ==================================================

const mobileSearchPanel =
    document.getElementById(
        "mobileSearchPanel"
    );


document
    .getElementById(
        "mobileSearchButton"
    )
    .addEventListener(
        "click",

        function () {

            mobileSearchPanel
                .classList
                .toggle(
                    "open"
                );


            if (
                mobileSearchPanel
                    .classList
                    .contains(
                        "open"
                    )
            ) {

                mobileSearch.focus();

            }

        }
    );


// ==================================================
// NAVBAR BACKGROUND
// ==================================================

window.addEventListener(
    "scroll",

    function () {

        const navbar =
            document.getElementById(
                "mainNavbar"
            );


        navbar.classList.toggle(
            "scrolled",

            window.scrollY >
                20
        );

    }
);


// ==================================================
// PAGE SHOW
// ==================================================

window.addEventListener(
    "pageshow",

    function () {

        if (
            movies.length > 0
        ) {

            renderContinueWatching();

            renderMyList();

        }

    }
);


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

loadMovies();
