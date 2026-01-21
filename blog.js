// Blog Posts Data
// Add new blog posts to this array
const blogPosts = [
    {
        slug: 'how-to-send-large-files',
        title: 'How to Send Large Files Over 25MB: The Complete Guide',
        excerpt: 'Hit the email attachment limit? Learn 7 proven methods to send large files over 25MB, from cloud storage to P2P transfer. Compare speed, security, and ease of use to find the perfect solution for your needs.',
        category: 'Guides',
        date: '2026-01-18',
        readTime: '10 min read',
        tags: ['send large files', 'email attachment limit', 'file sharing', 'guides']
    },
    {
        slug: 'secure-file-sharing-healthcare-legal-finance',
        title: 'How to Securely Share Confidential Files: Healthcare, Legal & Finance Guide',
        excerpt: 'Complete guide to secure file sharing for healthcare, legal, and finance professionals. Learn HIPAA-compliant methods, encryption standards, and best practices for sharing confidential files.',
        category: 'Security',
        date: '2026-01-19',
        readTime: '12 min read',
        tags: ['secure file sharing', 'HIPAA compliant', 'confidential files', 'healthcare', 'legal', 'finance', 'security']
    },
    {
        slug: 'p2p-vs-cloud-storage-file-transfer',
        title: 'P2P File Transfer vs Cloud Storage: Which is Better?',
        excerpt: 'Compare peer-to-peer file transfer and cloud storage. Learn the pros, cons, speed, security, and costs of each method to choose the best file sharing solution for your needs.',
        category: 'Comparisons',
        date: '2026-01-19',
        readTime: '8 min read',
        tags: ['P2P file transfer', 'cloud storage', 'file sharing comparison', 'WebRTC', 'privacy']
    },
    {
        slug: 'transfer-large-video-files-best-practices',
        title: 'Best Practices for Transferring Large Video Files',
        excerpt: 'Learn the best practices for transferring large video files. Discover compression techniques, optimal formats, and fast transfer methods for 4K videos, raw footage, and video projects.',
        category: 'Guides',
        date: '2026-01-20',
        readTime: '9 min read',
        tags: ['transfer video files', 'large video file sharing', 'video compression', '4K video', 'video file transfer']
    },
    {
        slug: 'send-large-files-phone-to-computer',
        title: 'How to Send Large Files from Phone to Computer',
        excerpt: 'Learn how to easily send large files from your phone to computer. Step-by-step guide for transferring videos, photos, and documents using P2P, cloud storage, and more.',
        category: 'Guides',
        date: '2026-01-21',
        readTime: '7 min read',
        tags: ['mobile file transfer', 'phone to computer', 'transfer photos', 'mobile to PC', 'file transfer']
    }
    // Add more blog posts below
];

// Format date to readable format
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Auto-generate image URL based on slug, or use provided image
function getImageUrl(post) {
    // If custom image is specified, use it
    if (post.image) {
        return post.image;
    }

    // Auto-detect image: try common formats based on slug
    // Images should be placed in /blog/images/[slug].jpg (or .png, .webp)
    // We'll default to .jpg and handle errors with onerror fallback
    return `/blog/images/${post.slug}.jpg`;
}

// Create blog card HTML
function createBlogCard(post) {
    const imageUrl = getImageUrl(post);

    // Image with fallback to gradient on error
    const imageHtml = `<img
        src="${imageUrl}"
        alt="${post.title}"
        class="blog-card-image"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    >
    <div class="blog-card-image" style="display: none; align-items: center; justify-content: center; color: white; font-size: 3em;">📄</div>`;

    const tagsHtml = post.tags && post.tags.length > 0
        ? `<div class="blog-tags">
            ${post.tags.map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
           </div>`
        : '';

    return `
        <article class="blog-card">
            ${imageHtml}
            <div class="blog-card-content">
                <div class="blog-card-meta">
                    <span class="blog-card-category">${post.category}</span>
                    <span>${formatDate(post.date)}</span>
                    ${post.readTime ? `<span>${post.readTime}</span>` : ''}
                </div>
                <h2><a href="/blog/${post.slug}">${post.title}</a></h2>
                <p class="blog-card-excerpt">${post.excerpt}</p>
                ${tagsHtml}
                <div class="blog-card-footer">
                    <a href="/blog/${post.slug}" class="read-more">
                        Read More <span>→</span>
                    </a>
                </div>
            </div>
        </article>
    `;
}

// Render blog posts
function renderBlogPosts() {
    const blogPostsContainer = document.getElementById('blog-posts');
    const comingSoonContainer = document.getElementById('coming-soon');

    if (!blogPostsContainer) return;

    if (blogPosts.length === 0) {
        // Show coming soon message
        blogPostsContainer.style.display = 'none';
        if (comingSoonContainer) {
            comingSoonContainer.style.display = 'block';
        }
    } else {
        // Sort posts by date (newest first)
        const sortedPosts = [...blogPosts].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // Render blog cards
        blogPostsContainer.innerHTML = sortedPosts.map(post => createBlogCard(post)).join('');
        blogPostsContainer.style.display = 'grid';
        if (comingSoonContainer) {
            comingSoonContainer.style.display = 'none';
        }
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBlogPosts);
} else {
    renderBlogPosts();
}
