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


const top10Container =
    document.getElementById(
        "top10Movies"
    );


const continueContainer =
    document.getElementById(
        "continueMovies"
    );


const myListContainer =
    document.getElementById(
        "myListMovies"
    );


const genreRows =
    document.getElementById(
        "genreRows"
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

        renderContinueWatching();

        renderTop10();

        renderLatest();

        renderTrending();

        renderGenreRows();

        renderMyList();


    } catch (error) {

        console.error(
            "Homepage load error:",
            error
        );


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

        document
            .getElementById(
                "heroTitle"
            )
            .textContent =
                "No movies yet";


        document
            .getElementById(
                "heroDescription"
            )
            .textContent =
                "Upload a movie from the admin panel.";


        return;

    }


    const movie =
        movies[0];


    document
        .getElementById(
            "heroTitle"
        )
        .textContent =
            movie.title;


    document
        .getElementById(
            "heroDescription"
        )
        .textContent =
            movie.description || "";


    document
        .getElementById(
            "heroMeta"
        )
        .innerHTML = `

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


    document
        .getElementById(
            "heroBackdrop"
        )
        .style
        .backgroundImage =
            `url("${movie.poster}")`;


    document
        .getElementById(
            "heroWatchButton"
        )
        .onclick =
            function () {

                window.location.href =
                    `/watch.html?id=${movie.id}`;

            };


    document
        .getElementById(
            "heroInfoButton"
        )
        .onclick =
            function () {

                window.location.href =
                    `/movie.html?id=${movie.id}`;

            };

}


// ==================================================
// SURPRISE ME
// ==================================================

document
    .getElementById(
        "surpriseButton"
    )
    .addEventListener(
        "click",

        function () {

            if (
                movies.length === 0
            ) {

                return;

            }


            const randomMovie =
                movies[
                    Math.floor(
                        Math.random()
                        *
                        movies.length
                    )
                ];


            window.location.href =
                `/movie.html?id=${randomMovie.id}`;

        }
    );


// ==================================================
// GENRE BUTTONS
// ==================================================

function renderGenres() {

    const genreSection =
        document.getElementById(
            "genreSection"
        );


    const genres =
        getAllGenres();


    genreSection.innerHTML =
        "";


    genreSection.appendChild(
        createGenreButton(
            "All",
            true
        )
    );


    genres.forEach(
        genre => {

            genreSection.appendChild(
                createGenreButton(
                    genre,
                    false
                )
            );

        }
    );

}


function createGenreButton(
    genre,
    active
) {

    const button =
        document.createElement(
            "button"
        );


    button.className =
        `genre-button${active ? " active" : ""}`;


    button.type =
        "button";


    button.dataset.genre =
        genre;


    button.textContent =
        genre;


    button.addEventListener(
        "click",

        function () {

            document
                .querySelectorAll(
                    ".genre-button"
                )
                .forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );


            button.classList.add(
                "active"
            );


            selectedGenre =
                genre;


            performSearch(
                searchInput.value
            );


            if (
                genre !== "All"
            ) {

                searchSection
                    .scrollIntoView({
                        behavior:
                            "smooth",

                        block:
                            "start"
                    });

            }

        }
    );


    return button;

}


function getAllGenres() {

    return [
        ...new Set(
            movies.flatMap(
                movie =>
                    parseGenres(
                        movie.genre
                    )
            )
        )
    ].sort();

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

                <div class="card-hover-actions">

                    <button
                        type="button"
                        class="card-play-button"
                        title="Play"
                    >
                        ▶
                    </button>


                    <button
                        type="button"
                        class="card-list-button"
                        title="My List"
                    >
                        ${
                            getMyList()
                                .includes(
                                    Number(movie.id)
                                )
                                ? "✓"
                                : "+"
                        }
                    </button>

                </div>


                <div class="hover-meta">

                    <strong>
                        ⭐ ${movie.rating}
                    </strong>

                    <span>
                        ${movie.year}
                    </span>

                </div>

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


    card
        .querySelector(
            ".card-play-button"
        )
        .addEventListener(
            "click",

            function (
                event
            ) {

                event.stopPropagation();


                window.location.href =
                    `/watch.html?id=${movie.id}`;

            }
        );


    card
        .querySelector(
            ".card-list-button"
        )
        .addEventListener(
            "click",

            function (
                event
            ) {

                event.stopPropagation();


                toggleMyList(
                    movie.id
                );


                renderMyList();


                renderLatest();

                renderTrending();

                renderTop10();

                renderGenreRows();

            }
        );


    return card;

}


// ==================================================
// TOP 10
// ==================================================

function renderTop10() {

    top10Container.innerHTML =
        "";


    const top =
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
                10
            );


    top.forEach(
        (
            movie,
            index
        ) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "top10-item";


            const rank =
                document.createElement(
                    "div"
                );


            rank.className =
                "top10-rank";


            rank.textContent =
                index + 1;


            item.appendChild(
                rank
            );


            item.appendChild(
                createMovieCard(
                    movie
                )
            );


            top10Container.appendChild(
                item
            );

        }
    );

}


// ==================================================
// RECENTLY ADDED
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
// DYNAMIC GENRE ROWS
// ==================================================

function renderGenreRows() {

    genreRows.innerHTML =
        "";


    const genres =
        getAllGenres();


    genres.forEach(
        genre => {

            const genreMovies =
                movies.filter(
                    movie =>
                        movieHasGenre(
                            movie,
                            genre
                        )
                );


            if (
                genreMovies.length === 0
            ) {

                return;

            }


            const section =
                document.createElement(
                    "section"
                );


            section.className =
                "movie-section";


            section.innerHTML = `

                <div class="section-heading">

                    <div>

                        <span class="section-kicker">
                            BROWSE BY GENRE
                        </span>

                        <h2>
                            ${escapeHtml(genre)}
                        </h2>

                    </div>

                </div>

                <div
                    class="movie-row"
                ></div>

            `;


            const row =
                section.querySelector(
                    ".movie-row"
                );


            genreMovies
                .slice(
                    0,
                    15
                )
                .forEach(
                    movie => {

                        row.appendChild(
                            createMovieCard(
                                movie
                            )
                        );

                    }
                );


            genreRows.appendChild(
                section
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


    const section =
        document.getElementById(
            "continueSection"
        );


    if (
        watched.length === 0
    ) {

        section.style.display =
            "none";


        return;

    }


    section.style.display =
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


function toggleMyList(
    movieId
) {

    let list =
        getMyList();


    const id =
        Number(
            movieId
        );


    if (
        list.includes(
            id
        )
    ) {

        list =
            list.filter(
                item =>
                    Number(item) !==
                    id
            );

    } else {

        list.push(
            id
        );

    }


    localStorage.setItem(
        "adamflix-my-list",
        JSON.stringify(
            list
        )
    );

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


    const section =
        document.getElementById(
            "myListSection"
        );


    if (
        myMovies.length === 0
    ) {

        section.style.display =
            "none";


        return;

    }


    section.style.display =
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


                const year =
                    String(
                        movie.year || ""
                    );


                const matchesText =
                    text === ""
                    ||
                    title.includes(
                        text
                    )
                    ||
                    genre.includes(
                        text
                    )
                    ||
                    year.includes(
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
// SEARCH SYNC
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


[
    searchInput,
    navSearch,
    mobileSearch
]
.forEach(
    input => {

        input.addEventListener(
            "input",

            function () {

                syncSearch(
                    this.value
                );

            }
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

        document
            .getElementById(
                "mainNavbar"
            )
            .classList
            .toggle(
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

    [
        latestContainer,
        trendingContainer,
        top10Container
    ]
    .forEach(
        container => {

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
