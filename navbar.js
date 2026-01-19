// Shared Navbar Component
// This file creates a reusable navbar that can be included in any page

function createNavbar() {
    return `
        <nav class="navbar">
            <div class="navbar-left">
                <a href="/" class="navbar-brand" role="banner">
                    <img src="/large-file-transfer.png" alt="LargeFileTransfer.org" class="navbar-logo" width="200" height="40">
                </a>
            </div>
            <div class="navbar-right">
                <ul class="navbar-nav" id="navbar-nav">
                    <li><a href="/"><i class="fas fa-home"></i> Home</a></li>
                    <li><a href="/blog">Blog</a></li>
                    <li><a href="/about">About</a></li>
                </ul>
                <button class="navbar-toggle" id="navbar-toggle" aria-label="Toggle navigation" aria-expanded="false">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
            </div>
        </nav>
    `;
}

function initializeNavbar() {
    // Find navbar container and inject the navbar
    const navbarContainer = document.getElementById('navbar-container');
    if (navbarContainer) {
        navbarContainer.innerHTML = createNavbar();

        // Initialize mobile navbar functionality
        const navbarToggle = document.getElementById('navbar-toggle');
        const navbarNav = document.getElementById('navbar-nav');

        if (navbarToggle && navbarNav) {
            navbarToggle.addEventListener('click', function() {
                const isExpanded = navbarToggle.getAttribute('aria-expanded') === 'true';
                navbarToggle.setAttribute('aria-expanded', !isExpanded);
                navbarNav.classList.toggle('active');
                navbarToggle.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', function(event) {
                if (!navbarToggle.contains(event.target) && !navbarNav.contains(event.target)) {
                    navbarNav.classList.remove('active');
                    navbarToggle.classList.remove('active');
                    navbarToggle.setAttribute('aria-expanded', 'false');
                }
            });

            // Close menu when window is resized to desktop
            window.addEventListener('resize', function() {
                if (window.innerWidth > 768) {
                    navbarNav.classList.remove('active');
                    navbarToggle.classList.remove('active');
                    navbarToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }
}

// Initialize navbar when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavbar);
} else {
    initializeNavbar();
}