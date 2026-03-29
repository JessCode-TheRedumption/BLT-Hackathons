/**
 * Index Page Logic
 * Displays list of all hackathons with robust error handling
 */

class HackathonIndex {
    constructor(config) {
        this.config = config;
        this.currentFilter = 'all';
        this.hackathonStats = {};
        this.loadedAt = null;
    }

    /**
     * Initialize the index page
     */
    async init() {
        this.loadedAt = new Date();
        const global = this.config.global || {};
        
        // Update site title
        if (global.siteName) {
            const siteTitle = document.getElementById('site-title');
            const heroTitle = document.getElementById('hero-title');
            if(siteTitle) siteTitle.textContent = global.siteName;
            if(heroTitle) heroTitle.textContent = global.siteName;
            document.title = global.siteName;
        }

        if (global.siteDescription) {
            const heroDesc = document.getElementById('hero-description');
            if(heroDesc) heroDesc.textContent = global.siteDescription;
        }

        // Load stats for all hackathons, then render
        await this.loadAllStats();
        this.renderHackathons();
    }

    /**
     * Load pre-fetched stats for all hackathons
     */
    async loadAllStats() {
        const fetches = (this.config.hackathons || []).map(async hackathon => {
            try {
                const response = await fetch(`hackathon-data/${hackathon.slug}-summary.json`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const summary = await response.json();

                // Calculate days active
                const startDate = new Date(hackathon.startTime);
                const endDate = new Date(hackathon.endTime);
                const now = new Date();
                const effectiveEnd = now < endDate ? now : endDate;
                const daysActive = now < startDate
                    ? 0
                    : Math.floor((effectiveEnd - startDate) / (1000 * 60 * 60 * 24));

                this.hackathonStats[hackathon.slug] = {
                    participantCount: summary.participantCount || 0,
                    totalPRs: summary.totalPRs || 0,
                    mergedPRs: summary.mergedPRs || 0,
                    totalIssues: summary.totalIssues || 0,
                    repositories: summary.repositories || 0,
                    topContributors: summary.topContributors || [],
                    daysActive,
                    error: false
                };
            } catch (e) {
                console.warn(`Failed to load stats for ${hackathon.slug}:`, e);
                // Mark this specific hackathon as having an error state
                this.hackathonStats[hackathon.slug] = { error: true };
            }
        });
        await Promise.all(fetches);
    }

    /**
     * Get status of a hackathon
     */
    getHackathonStatus(hackathon) {
        const now = new Date();
        const startDate = new Date(hackathon.startTime);
        const endDate = new Date(hackathon.endTime);

        if (now < startDate) {
            return { status: 'upcoming', label: 'Upcoming', class: 'bg-blue-100 text-blue-800' };
        } else if (now > endDate) {
            return { status: 'ended', label: 'Ended', class: 'bg-gray-100 text-gray-800' };
        } else {
            return { status: 'ongoing', label: 'Ongoing', class: 'bg-green-100 text-green-800' };
        }
    }

    /**
     * Format date range for display
     */
    formatDateRange(startTime, endTime) {
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }

    /**
     * Get time remaining
     */
    getTimeRemaining(hackathon) {
        const now = new Date();
        const startDate = new Date(hackathon.startTime);
        const endDate = new Date(hackathon.endTime);

        if (now < startDate) {
            const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
            return `Starts in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
        } else if (now <= endDate) {
            const remaining = endDate - now;
            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            if (days > 0) return `${days} day${days !== 1 ? 's' : ''} remaining`;
            if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
            return 'Ending soon';
        }
        return 'Ended';
    }

    /**
     * Render all hackathons
     */
    renderHackathons(filter = 'all') {
        this.currentFilter = filter;
        const container = document.getElementById('hackathons-grid');
        const noHackathonsMsg = document.getElementById('no-hackathons');
        
        let hackathons = [...(this.config.hackathons || [])];
        
        if (filter !== 'all') {
            hackathons = hackathons.filter(h => this.getHackathonStatus(h).status === filter);
        }

        if (hackathons.length === 0) {
            if(container) container.classList.add('hidden');
            if(noHackathonsMsg) noHackathonsMsg.classList.remove('hidden');
            return;
        }

        if(container) container.classList.remove('hidden');
        if(noHackathonsMsg) noHackathonsMsg.classList.add('hidden');

        // Sort logic
        hackathons.sort((a, b) => {
            const statusOrder = { ongoing: 0, upcoming: 1, ended: 2 };
            const orderA = statusOrder[this.getHackathonStatus(a).status];
            const orderB = statusOrder[this.getHackathonStatus(b).status];
            if (orderA !== orderB) return orderA - orderB;
            return statusOrder[this.getHackathonStatus(a).status] === 2 
                ? new Date(b.endTime) - new Date(a.endTime) 
                : new Date(a.startTime) - new Date(b.startTime);
        });

        if(container) {
            container.innerHTML = hackathons.map(hackathon => {
                const status = this.getHackathonStatus(hackathon);
                const stats = this.hackathonStats[hackathon.slug];
                
                let statsHtml = '';
                if (stats && stats.error) {
                    // PROFESSIONAL ERROR STATE UI
                    statsHtml = `
                        <div class="p-3 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                            <i class="fas fa-exclamation-triangle mr-1"></i> Data sync error. 
                            <button onclick="location.reload()" class="underline font-bold hover:text-yellow-900 ml-1">Retry</button>
                        </div>`;
                } else if (stats) {
                    statsHtml = `
                        <div class="grid grid-cols-3 gap-2 mb-4">
                            ${this.renderStatItem(stats.participantCount, 'Participants')}
                            ${this.renderStatItem(stats.totalPRs, 'PRs')}
                            ${this.renderStatItem(stats.mergedPRs, 'Merged')}
                            ${this.renderStatItem(stats.totalIssues, 'Issues')}
                            ${this.renderStatItem(stats.repositories, 'Repos')}
                            ${this.renderStatItem(stats.daysActive, 'Active Days')}
                        </div>`;
                }

                const safeBannerImage = this.sanitizeImageUrl(hackathon.bannerImage);

                return `
                    <div class="hackathon-card bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-full transform transition-transform hover:scale-105">
                        <div class="h-48 bg-red-700 relative flex items-center justify-center text-white p-6">
                            ${safeBannerImage ? 
                                `<img src="${safeBannerImage}" alt="" class="absolute inset-0 w-full h-full object-cover opacity-40">` : ''}
                            <div class="relative z-10 text-center">
                                <h3 class="text-xl font-bold leading-tight">${this.escapeHtml(hackathon.name)}</h3>
                                <p class="text-xs mt-2 opacity-90 italic">${this.formatDateRange(hackathon.startTime, hackathon.endTime)}</p>
                            </div>
                            <span class="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${status.class}">
                                ${status.label}
                            </span>
                        </div>
                        <div class="p-6 flex-grow flex flex-col">
                            <p class="text-gray-600 text-sm mb-4">${this.escapeHtml(hackathon.description)}</p>
                            <div class="mt-auto">
                                ${statsHtml}
                                <a href="hackathon.html?slug=${encodeURIComponent(hackathon.slug)}" 
                                   class="block w-full text-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition">
                                   View Details <i class="fas fa-arrow-right ml-2"></i>
                                </a>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    renderStatItem(value, label) {
        return `
            <div class="text-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                <div class="text-base font-bold text-red-600">${value.toLocaleString()}</div>
                <div class="text-xs uppercase tracking-tight text-gray-500">${label}</div>
            </div>`;
    }

    /**
     * Update API info and handle Rate Limit Warnings
     */
    async updateApiInfo() {
        const infoEl = document.getElementById('github-api-info');
        if (!infoEl) return;

        // Client-side GitHub tokens are intentionally not supported.
        // If you need authenticated requests, use a server-side proxy.
        const headers = { 'Accept': 'application/vnd.github.v3+json' };

        try {
            const response = await fetch('https://api.github.com/rate_limit', { headers });
            if (response.ok) {
                const data = await response.json();
                const rl = data.rate;
                
                // Only show the "limit reached" banner when the limit is actually exhausted.
                if (rl.remaining === 0) {
                    this.showRateLimitBanner(new Date(rl.reset * 1000));
                }

                const pct = Math.round((rl.remaining / rl.limit) * 100);
                const barColor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
                
                infoEl.innerHTML = `
                    <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400">
                        <span class="text-yellow-500 font-medium">
                            <i class="fas fa-user-secret"></i> Unauthenticated
                        </span>
                        <span>|</span>
                        <span>API: <strong>${rl.remaining}</strong> / ${rl.limit}</span>
                        <div class="w-12 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                            <div class="h-full ${barColor}" style="width:${pct}%"></div>
                        </div>
                        <span>|</span>
                        <span>Resets: ${new Date(rl.reset * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>`;
            }
        } catch (e) {
            console.warn('Rate limit check failed', e);
        }
    }

    showRateLimitBanner(resetTime) {
        if (document.getElementById('rate-limit-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'rate-limit-banner';
        banner.className = 'bg-red-600 text-white text-center py-2 px-4 text-sm font-bold sticky top-0 z-50 animate-pulse';
        banner.innerHTML = `
            <i class="fas fa-exclamation-triangle mr-2"></i>
            GitHub API rate limit reached. Some live requests may fail until ${resetTime.toLocaleTimeString()}.
        `;
        document.body.prepend(banner);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttribute(text) {
        return this.escapeHtml(text)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    sanitizeImageUrl(url) {
        if (!url) return '';
        const raw = String(url).trim();
        if (!raw) return '';

        try {
            const u = new URL(raw, window.location.href);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
            return this.escapeAttribute(u.href);
        } catch {
            return '';
        }
    }
}

// Global filter function
window.filterHackathons = (status) => {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const isActive = btn.dataset.filter === status;
        btn.classList.toggle('bg-red-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('bg-gray-200', !isActive);
        btn.classList.toggle('text-gray-700', !isActive);
    });
    window.hackathonIndex.renderHackathons(status);
};

document.addEventListener('DOMContentLoaded', async () => {
    window.hackathonIndex = new HackathonIndex(HACKATHONS_CONFIG);
    await window.hackathonIndex.init();
    window.hackathonIndex.updateApiInfo();
});