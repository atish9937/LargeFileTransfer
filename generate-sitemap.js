const fs = require('fs');
const path = require('path');

/**
 * Generates sitemap.xml automatically from blog posts and static pages
 * Includes ALL pages (static pages + blog posts)
 * Run this script whenever you add new blog posts or pages
 */

// Base URL - CHANGE THIS TO YOUR PRODUCTION DOMAIN
// Detects production in multiple ways:
// 1. NODE_ENV=production
// 2. SITE_URL env variable
// 3. Default to production if neither is set (assumes production deployment)
const BASE_URL = process.env.SITE_URL
    || (process.env.NODE_ENV === 'production' ? 'https://largefiletransfer.org' : null)
    || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null)
    || 'https://largefiletransfer.org'; // Default to production

// Extract blog posts from blog.js
function extractBlogPosts() {
    const blogJsContent = fs.readFileSync(path.join(__dirname, 'blog.js'), 'utf-8');

    // Extract the blogPosts array using regex
    const match = blogJsContent.match(/const blogPosts = \[([\s\S]*?)\];/);
    if (!match) {
        console.error('Could not find blogPosts array in blog.js');
        return [];
    }

    // Parse the blog posts
    // We'll use eval in a safe context since we control the source
    const blogPostsArrayText = match[0];
    let blogPosts = [];

    try {
        // Safe evaluation in isolated context
        eval(blogPostsArrayText.replace('const blogPosts = ', 'blogPosts = '));
    } catch (error) {
        console.error('Error parsing blog posts:', error);
        return [];
    }

    return blogPosts;
}

// Static pages configuration
// ADD NEW PAGES HERE when you create them
const staticPages = [
    { url: '/', changefreq: 'daily', priority: '1.0' },
    { url: '/home', changefreq: 'weekly', priority: '0.8' },
    { url: '/about', changefreq: 'monthly', priority: '0.7' },
    { url: '/blog', changefreq: 'weekly', priority: '0.9' },
    { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
    { url: '/terms', changefreq: 'yearly', priority: '0.3' }
];

// Generate sitemap XML
function generateSitemap() {
    const blogPosts = extractBlogPosts();
    const now = new Date().toISOString();

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    console.log(`Adding ${staticPages.length} static pages to sitemap...`);
    staticPages.forEach(page => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${BASE_URL}${page.url}</loc>\n`;
        sitemap += `    <lastmod>${now}</lastmod>\n`;
        sitemap += `    <changefreq>${page.changefreq}</changefreq>\n`;
        sitemap += `    <priority>${page.priority}</priority>\n`;
        sitemap += '  </url>\n';
    });

    // Add blog posts
    console.log(`Adding ${blogPosts.length} blog posts to sitemap...`);
    blogPosts.forEach(post => {
        // Convert date to ISO format
        const postDate = new Date(post.date).toISOString();

        sitemap += '  <url>\n';
        sitemap += `    <loc>${BASE_URL}/blog/${post.slug}</loc>\n`;
        sitemap += `    <lastmod>${postDate}</lastmod>\n`;
        sitemap += `    <changefreq>monthly</changefreq>\n`;
        sitemap += `    <priority>0.8</priority>\n`;
        sitemap += '  </url>\n';
    });

    sitemap += '</urlset>';

    return sitemap;
}

// Write sitemap to file
function writeSitemap() {
    try {
        const sitemap = generateSitemap();
        const sitemapPath = path.join(__dirname, 'sitemap.xml');

        fs.writeFileSync(sitemapPath, sitemap, 'utf-8');

        const totalPages = staticPages.length;
        const totalPosts = extractBlogPosts().length;
        const totalUrls = totalPages + totalPosts;

        console.log('\n✓ Sitemap generated successfully!');
        console.log(`  Location: ${sitemapPath}`);
        console.log(`  Static pages: ${totalPages}`);
        console.log(`  Blog posts: ${totalPosts}`);
        console.log(`  Total URLs: ${totalUrls}\n`);

        return true;
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return false;
    }
}

// Export for use in other files
module.exports = { generateSitemap, writeSitemap };

// Run if executed directly
if (require.main === module) {
    writeSitemap();
}