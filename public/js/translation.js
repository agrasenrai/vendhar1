class Translator {
    constructor() {
        this.currentLang = localStorage.getItem('selectedLanguage') || 'en';
        this.translationCache = new Map();
        this.loadCacheFromStorage();
        this.initializeLanguageSelector();
    }

    initializeLanguageSelector() {
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.value = this.currentLang;
            languageSelect.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
        }
    }

    loadCacheFromStorage() {
        const cached = localStorage.getItem('translationCache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                Object.entries(parsed).forEach(([key, value]) => {
                    this.translationCache.set(key, value);
                });
            } catch (error) {
                console.error('Error loading translation cache:', error);
            }
        }
    }

    saveCacheToStorage() {
        const cacheObj = {};
        this.translationCache.forEach((value, key) => {
            cacheObj[key] = value;
        });
        localStorage.setItem('translationCache', JSON.stringify(cacheObj));
    }

    async setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('selectedLanguage', lang);
        await this.translatePage();
    }

    async translateText(text) {
        if (this.currentLang === 'en') return text;

        const cacheKey = `${text}_${this.currentLang}`;
        if (this.translationCache.has(cacheKey)) {
            console.log('Using cached translation for:', text);
            return this.translationCache.get(cacheKey);
        }

        try {
            console.log('Requesting translation for:', text, 'to', this.currentLang);
            const response = await fetch(`http://localhost:3000/translate?text=${encodeURIComponent(text)}&targetLang=${this.currentLang}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Translation API error:', errorData);
                throw new Error(`Translation failed: ${errorData.error || response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Translation API response:', data);
            
            if (data.translatedText) {
                this.translationCache.set(cacheKey, data.translatedText);
                this.saveCacheToStorage();
                return data.translatedText;
            } else {
                throw new Error('No translation returned');
            }
        } catch (error) {
            console.error('Translation error:', error);
            return text; // Return original text on error
        }
    }

    async translatePage() {
        const elements = document.querySelectorAll('[data-translate]');
        const translations = new Map();

        // First, collect all unique texts to translate
        for (const element of elements) {
            const originalText = element.getAttribute('data-translate');
            if (!translations.has(originalText)) {
                translations.set(originalText, await this.translateText(originalText));
            }
        }

        // Then apply translations
        for (const element of elements) {
            const originalText = element.getAttribute('data-translate');
            element.textContent = translations.get(originalText);
        }
    }

    clearCache() {
        this.translationCache.clear();
        localStorage.removeItem('translationCache');
    }

    updateTranslations(translations) {
        // ... existing translation code ...

        // Handle placeholders
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            if (translations[key]) {
                element.placeholder = translations[key];
            }
        });
    }

    // Add method to translate new content
    async translateNewContent(element) {
        const elements = element.querySelectorAll('[data-translate]');
        for (const el of elements) {
            const originalText = el.getAttribute('data-translate');
            const translatedText = await this.translateText(originalText);
            el.textContent = translatedText;
        }
    }
}

// Initialize translator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.translator = new Translator();
    window.translator.translatePage();

    // Create observer for news ticker content
    const tickerObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                window.translator.translateNewContent(mutation.target);
            }
        });
    });

    // Start observing the ticker content
    const tickerContent = document.getElementById('tickerContent');
    if (tickerContent) {
        tickerObserver.observe(tickerContent, {
            childList: true,
            subtree: true
        });
    }
}); 