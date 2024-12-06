function updateTickerContent(message) {
    const tickerContent = document.getElementById("tickerContent");
    const newsTicker = document.getElementById("newsTicker");

    // Update the content of the ticker
    if (message && message.trim() !== "") {
        tickerContent.innerHTML = `<span class="ticker-item">${message}</span>`;
        newsTicker.style.display = "block"; // Show the ticker
    } else {
        tickerContent.innerHTML = "";
        newsTicker.style.display = "none"; // Hide the ticker
    }
}

let map;
let isMapInitialized = false;

function toggleMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
        mapContainer.style.display = 'block';
    } else {
        mapContainer.style.display = 'none';
    }
}

// Add event listener to make sure the function is properly bound
document.addEventListener('DOMContentLoaded', () => {
    const mapButtons = document.querySelectorAll('.footer-map-button');
    mapButtons.forEach(button => {
        button.addEventListener('click', toggleMap);
    });
});

function initCarousel() {
    const track = document.querySelector('.carousel-track');
    if (!track) return;

    const slides = Array.from(track.children);
    const nextButton = document.querySelector('.carousel-button.next');
    const prevButton = document.querySelector('.carousel-button.prev');
    
    // Create indicators
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'carousel-indicators';
    slides.forEach((_, index) => {
        const indicator = document.createElement('div');
        indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
        indicator.addEventListener('click', () => goToSlide(index));
        indicatorsContainer.appendChild(indicator);
    });
    track.parentElement.appendChild(indicatorsContainer);

    let currentIndex = 0;
    let startPos = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let isDragging = false;

    // Clone first and last slides for infinite loop
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    track.appendChild(firstClone);
    track.insertBefore(lastClone, slides[0]);

    // Update track position after adding clones
    track.style.transform = `translateX(-${100}%)`;

    function updateSlides(index) {
        const slideWidth = slides[0].offsetWidth;
        currentIndex = index;
        
        // Calculate the translation including the initial offset for the cloned slide
        const translate = -(currentIndex + 1) * slideWidth;
        
        track.style.transition = 'transform 0.5s ease-in-out';
        track.style.transform = `translateX(${translate}px)`;

        // Update indicators
        document.querySelectorAll('.indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === currentIndex);
        });
    }

    function handleTransitionEnd() {
        const slideWidth = slides[0].offsetWidth;
        
        // If we're at the clone of the last slide, jump to the real last slide
        if (currentIndex === -1) {
            track.style.transition = 'none';
            currentIndex = slides.length - 1;
            track.style.transform = `translateX(-${(currentIndex + 1) * slideWidth}px)`;
        }
        
        // If we're at the clone of the first slide, jump to the real first slide
        if (currentIndex === slides.length) {
            track.style.transition = 'none';
            currentIndex = 0;
            track.style.transform = `translateX(-${slideWidth}px)`;
        }
    }

    function goToSlide(index) {
        updateSlides(index);
    }

    function nextSlide() {
        if (currentIndex >= slides.length - 1) {
            currentIndex = -1;
        }
        updateSlides(currentIndex + 1);
    }

    function prevSlide() {
        if (currentIndex <= 0) {
            currentIndex = slides.length;
        }
        updateSlides(currentIndex - 1);
    }

    // Event Listeners
    track.addEventListener('transitionend', handleTransitionEnd);
    
    if (nextButton) nextButton.addEventListener('click', nextSlide);
    if (prevButton) prevButton.addEventListener('click', prevSlide);

    // Touch events
    track.addEventListener('touchstart', (e) => {
        startPos = e.touches[0].clientX;
        isDragging = true;
        track.style.transition = 'none';
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentPosition = e.touches[0].clientX;
        const diff = currentPosition - startPos;
        const slideWidth = slides[0].offsetWidth;
        const translate = -((currentIndex + 1) * slideWidth) + diff;
        track.style.transform = `translateX(${translate}px)`;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        isDragging = false;
        const moveBy = startPos - e.changedTouches[0].clientX;
        
        if (Math.abs(moveBy) > 100) {
            if (moveBy > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        } else {
            updateSlides(currentIndex);
        }
    });

    // Auto advance slides
    let autoAdvance = setInterval(nextSlide, 5000);

    // Pause on hover/touch
    track.addEventListener('mouseenter', () => clearInterval(autoAdvance));
    track.addEventListener('touchstart', () => clearInterval(autoAdvance));

    track.addEventListener('mouseleave', () => {
        autoAdvance = setInterval(nextSlide, 5000);
    });
    track.addEventListener('touchend', () => {
        autoAdvance = setInterval(nextSlide, 5000);
    });

    // Initial setup
    updateSlides(0);

    // Handle window resize
    window.addEventListener('resize', () => {
        updateSlides(currentIndex);
    });
}

// Initialize carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', initCarousel);

document.addEventListener('DOMContentLoaded', function() {
    // Add this at the beginning of your DOMContentLoaded event listener
    const header = document.querySelector('.header');
    
    function updateHeader() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    // Initial check
    updateHeader();

    // Add scroll event listener
    window.addEventListener('scroll', updateHeader);

    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));

    // Hamburger menu functionality
    const hamburger = document.querySelector('.hamburger');
    const nav = document.querySelector('.nav');
    const body = document.body;

    if (hamburger && nav) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            hamburger.classList.toggle('active');
            nav.classList.toggle('active');
            body.classList.toggle('menu-open');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (nav.classList.contains('active') && 
                !nav.contains(e.target) && 
                !hamburger.contains(e.target)) {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });

        // Close menu when pressing Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });
    }

    // Optimize carousel for mobile
    const carousel = document.querySelector('.carousel-track');
    if (carousel) {
        let touchStartX = 0;
        let touchEndX = 0;

        carousel.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        carousel.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);

        function handleSwipe() {
            const difference = touchStartX - touchEndX;
            if (Math.abs(difference) > 50) { // Minimum swipe distance
                if (difference > 0) {
                    // Swipe left - next slide
                    document.querySelector('.carousel-button.next')?.click();
                } else {
                    // Swipe right - previous slide
                    document.querySelector('.carousel-button.prev')?.click();
                }
            }
        }
    }

    // Add scroll arrows to all sections except the last one
    const sections = document.querySelectorAll('section:not(:last-of-type)');
    sections.forEach(section => {
        if (!section.querySelector('.scroll-down, .section-scroll')) {
            const scrollButton = document.createElement('button');
            scrollButton.className = section.classList.contains('hero') ? 'scroll-down' : 'section-scroll';
            scrollButton.setAttribute('aria-label', 'Scroll to next section');
            scrollButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
            section.appendChild(scrollButton);
        }
    });

    // Handle scroll functionality for all scroll arrows
    document.addEventListener('click', function(e) {
        if (e.target.closest('.scroll-down, .section-scroll')) {
            const currentSection = e.target.closest('section');
            const nextSection = currentSection.nextElementSibling;
            if (nextSection) {
                // Calculate offset for header and news ticker
                const headerHeight = document.querySelector('.header').offsetHeight;
                const newsTickerHeight = document.querySelector('.news-ticker').offsetHeight;
                const totalOffset = headerHeight + newsTickerHeight;

                // Scroll with offset
                window.scrollTo({
                    top: nextSection.offsetTop - totalOffset,
                    behavior: 'smooth'
                });
            }
        }
    });

    // Handle scroll arrow visibility
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        
        const scrollArrows = document.querySelectorAll('.scroll-down, .section-scroll');
        scrollArrows.forEach(arrow => {
            const section = arrow.closest('section');
            const sectionRect = section.getBoundingClientRect();
            const isVisible = sectionRect.top <= 100 && sectionRect.bottom >= window.innerHeight;
            
            if (isVisible) {
                arrow.style.opacity = '0.7';
                arrow.style.pointerEvents = 'auto';
            } else {
                arrow.style.opacity = '0';
                arrow.style.pointerEvents = 'none';
            }
        });

        scrollTimeout = setTimeout(() => {
            scrollArrows.forEach(arrow => {
                arrow.style.opacity = '0.7';
                arrow.style.pointerEvents = 'auto';
            });
        }, 1000);
    });

    // Scroll-to navigation
    const scrollLinks = document.querySelectorAll('.scroll-to');
    scrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const newsTickerHeight = document.querySelector('.news-ticker').offsetHeight;
                const totalOffset = headerHeight + newsTickerHeight;

                window.scrollTo({
                    top: targetSection.offsetTop - totalOffset,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Highlight active section in navigation
    window.addEventListener('scroll', function() {
        const sections = document.querySelectorAll('section[id]');
        const scrollPosition = window.scrollY + window.innerHeight / 2;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`.scroll-to[href="#${sectionId}"]`);

            if (navLink && scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                document.querySelectorAll('.scroll-to').forEach(link => link.classList.remove('active'));
                navLink.classList.add('active');
            }
        });
    });
});