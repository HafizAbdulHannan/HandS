// GSAP Scroll Animations
gsap.registerPlugin(ScrollTrigger);

// Animate background shapes slowly
gsap.to('.shape-1', {
    x: 100,
    y: 50,
    duration: 10,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut'
});

gsap.to('.shape-2', {
    x: -100,
    y: -50,
    duration: 12,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut'
});

gsap.to('.shape-3', {
    rotation: 360,
    duration: 20,
    repeat: -1,
    ease: 'linear'
});

// Hero animations
gsap.from('.hero-content > *', {
    y: 50,
    opacity: 0,
    duration: 1,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.2
});

gsap.from('.app-screenshot', {
    y: 100,
    opacity: 0,
    duration: 1.5,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.5
});

// 3D Tilt Effect on Cards & Phone
const tiltCards = document.querySelectorAll('.tilt-card');

tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -15; // Max 15deg
        const rotateY = ((x - centerX) / centerX) * 15;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
    });
});

// Scroll Animations for Features
gsap.from('.feature-card', {
    scrollTrigger: {
        trigger: '.features',
        start: 'top 80%'
    },
    y: 50,
    opacity: 0,
    duration: 0.8,
    stagger: 0.15,
    ease: 'power2.out'
});

// Scroll Animations for Guide Timeline
gsap.from('.timeline-item', {
    scrollTrigger: {
        trigger: '.guide',
        start: 'top 70%'
    },
    x: -50,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power2.out'
});

// Scroll Animations for Ratings
gsap.from('.rating-card', {
    scrollTrigger: {
        trigger: '.ratings',
        start: 'top 80%'
    },
    scale: 0.9,
    opacity: 0,
    duration: 0.6,
    stagger: 0.15,
    ease: 'back.out(1.7)'
});

// API URL
const API_URL = 'http://localhost:5000/api/website';

// Fetch and render Stats
async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        const stats = await res.json();
        
        const statsBanner = document.getElementById('statsBanner');
        if (statsBanner) {
            statsBanner.innerHTML = `
                <div class="stat-item">
                    <h2 class="stat-number">${stats.totalUsers || 0}</h2>
                    <p class="stat-label">Total Active Users</p>
                </div>
                <div class="stat-item">
                    <h2 class="stat-number">${stats.averageRating || 0}/5</h2>
                    <p class="stat-label">Overall Rating (${stats.totalReviews || 0} Reviews)</p>
                </div>
                <div class="stat-item">
                    <h2 class="stat-number">${stats.syncAccuracy}</h2>
                    <p class="stat-label">Sync Accuracy</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// Fetch and render Feedback
async function loadFeedback() {
    try {
        const res = await fetch(`${API_URL}/feedback`);
        const feedback = await res.json();
        
        const grid = document.getElementById('feedbackGrid');
        if (!grid) return;
        
        if (feedback.length === 0) {
            grid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-secondary);">Nothing to show right now.</p>';
            return;
        }
        
        grid.innerHTML = feedback.map(item => `
            <div class="rating-card">
                <div class="stars">${'⭐'.repeat(item.rating)}</div>
                <p>"${item.comment}"</p>
                <div class="user">- ${item.name}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading feedback:', err);
    }
}

// Fetch and render Questions
async function loadQuestions() {
    try {
        const res = await fetch(`${API_URL}/questions`);
        const questions = await res.json();
        
        const grid = document.getElementById('questionGrid');
        if (!grid) return;
        
        if (questions.length === 0) {
            grid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-secondary);">Nothing to show right now.</p>';
            return;
        }
        
        grid.innerHTML = questions.map(q => `
            <div class="rating-card question-card">
                <div class="user">${q.name} asked:</div>
                <p class="q-text">"${q.question}"</p>
                <div class="reply"><strong>HandS Team:</strong> ${q.reply || 'Thanks for your question! We will reply soon.'}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading questions:', err);
    }
}

// Load all data on init
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadFeedback();
    loadQuestions();
});

// Handle Contact Form Submission
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = contactForm.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Sending...';
        btn.disabled = true;
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        try {
            const res = await fetch(`${API_URL}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message })
            });
            
            if (res.ok) {
                const newQuestion = await res.json();
                
                // Add to UI
                const grid = document.getElementById('questionGrid');
                // Remove empty state text if exists
                if (grid.innerHTML.includes('Nothing to show right now')) {
                    grid.innerHTML = '';
                }
                
                const newCard = document.createElement('div');
                newCard.className = 'rating-card question-card';
                newCard.innerHTML = `
                    <div class="user">${newQuestion.name} asked:</div>
                    <p class="q-text">"${newQuestion.question}"</p>
                    <div class="reply"><strong>HandS Team:</strong> Thanks for your question! We will reply soon.</div>
                `;
                
                gsap.from(newCard, { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out' });
                grid.prepend(newCard);
                
                contactForm.reset();
                formStatus.style.display = 'block';
                formStatus.style.color = '#10b981';
                formStatus.innerText = 'Question submitted! It will appear below shortly.';
                
                setTimeout(() => { formStatus.style.display = 'none'; }, 3000);
            }
        } catch (err) {
            console.error('Submit error:', err);
            formStatus.style.display = 'block';
            formStatus.style.color = 'red';
            formStatus.innerText = 'Error submitting question.';
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}
