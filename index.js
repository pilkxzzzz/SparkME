import { supabase } from './config.js';

let currentUser = null;
let currentPage = 0;
const PROFILES_PER_PAGE = 10;
let isLoading = false;
let hasMoreProfiles = true;

async function initializeFeed() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user;
        
        await loadProfiles();
        setupInfiniteScroll();
    } catch (error) {
        console.error('Помилка ініціалізації:', error);
    }
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoading || !hasMoreProfiles) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        // Завантажуємо нові профілі, коли користувач догортав до кінця
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadProfiles();
        }
    });
}

async function loadProfiles() {
    if (isLoading || !hasMoreProfiles) return;
    
    const profilesContainer = document.getElementById('profilesContainer');
    const loaderElement = document.getElementById('profilesLoader');
    const endMessageElement = document.getElementById('endMessage');
    
    try {
        isLoading = true;
        if (loaderElement) loaderElement.style.display = 'flex';

        // Отримуємо профілі з пагінацією
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .range(currentPage * PROFILES_PER_PAGE, (currentPage + 1) * PROFILES_PER_PAGE - 1)
            .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        // Якщо це перша сторінка і немає профілів
        if (currentPage === 0 && (!profiles || profiles.length === 0)) {
            profilesContainer.innerHTML = `
                <div class="no-profiles">
                    <i class="fas fa-users"></i>
                    <h3>Поки що немає анкет</h3>
                    <p>Станьте першим!</p>
                </div>
            `;
            hasMoreProfiles = false;
            return;
        }

        // Якщо отримали менше профілів ніж очікували, значить це останні
        if (!profiles || profiles.length < PROFILES_PER_PAGE) {
            hasMoreProfiles = false;
            if (endMessageElement) {
                endMessageElement.style.display = 'flex';
            } else {
                profilesContainer.insertAdjacentHTML('afterend', `
                    <div id="endMessage" class="end-message">
                        <div class="end-message-content">
                            <i class="fas fa-heart-broken"></i>
                            <h3>Нажаль, це всі анкети на даний момент</h3>
                            <p>Запроси друзів, щоб стрічка не закінчувалась!</p>
                            <button onclick="shareApp()" class="share-button">
                                <i class="fas fa-share"></i>
                                Запросити друзів
                            </button>
                        </div>
                    </div>
                `);
            }
        }

        // Додаємо нові профілі до контейнера
        const profilesHTML = profiles.map(profile => `
            <div class="profile-card" onclick="showProfileModal('${profile.id}')">
                <div class="profile-preview">
                    <div class="profile-avatar">
                        <img src="${profile.avatar_url ? 
                            supabase.storage.from('profiles').getPublicUrl(profile.avatar_url).data.publicUrl 
                            : './images/default-avatar.png'}" 
                            alt="${profile.name || 'Користувач'}" 
                            class="profile-photo">
                    </div>
                    <div class="profile-gallery-preview">
                        <img src="${profile.gallery?.[0] ? 
                            supabase.storage.from('profiles').getPublicUrl(profile.gallery[0]).data.publicUrl 
                            : './images/default-gallery.png'}" 
                            alt="Галерея" 
                            class="gallery-preview-photo">
                    </div>
                </div>
                <div class="profile-info">
                    <div class="profile-header">
                        <h3>${profile.name || 'Без імені'}, ${profile.age || '?'}</h3>
                        <p class="location"><i class="fas fa-map-marker-alt"></i> ${profile.city || 'Не вказано'}</p>
                    </div>
                    <div class="profile-brief">
                        ${profile.interests && profile.interests.length > 0 ? `
                            <div class="interests-preview">
                                ${profile.interests.slice(0, 3).map(interest => `
                                    <span class="interest-tag">${interest}</span>
                                `).join('')}
                                ${profile.interests.length > 3 ? `
                                    <span class="interest-more">+${profile.interests.length - 3}</span>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <button onclick="toggleLike('${profile.id}', event)" class="like-button">
                        <i class="fas fa-heart"></i>
                        <span class="like-count">0</span>
                    </button>
                </div>
            </div>
        `).join('');

        // Якщо це перша сторінка, замінюємо вміст, інакше додаємо
        if (currentPage === 0) {
            profilesContainer.innerHTML = profilesHTML;
        } else {
            profilesContainer.insertAdjacentHTML('beforeend', profilesHTML);
        }

        currentPage++;

    } catch (error) {
        console.error('Помилка завантаження профілів:', error);
        if (currentPage === 0) {
            profilesContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Помилка завантаження</h3>
                    <p>Спробуйте оновити сторінку</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
        if (loaderElement) loaderElement.style.display = 'none';
    }
}

// Функція для шерингу додатку
window.shareApp = () => {
    if (navigator.share) {
        navigator.share({
            title: 'SparkME',
            text: 'Приєднуйся до SparkME - знаходь нових друзів та спілкуйся!',
            url: window.location.origin
        }).catch(console.error);
    } else {
        // Якщо API шерингу недоступне, копіюємо посилання в буфер обміну
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = window.location.origin;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        alert('Посилання скопійовано! Поділіться ним з друзями 😊');
    }
};

window.showProfileModal = async (profileId) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single();

        if (error) throw error;

        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <div class="modal-profile">
                <div class="modal-gallery">
                    <img src="${profile.avatar_url ? 
                        supabase.storage.from('profiles').getPublicUrl(profile.avatar_url).data.publicUrl 
                        : './images/default-avatar.png'}" 
                        class="modal-main-photo">
                    ${profile.gallery ? `
                        <div class="gallery-grid">
                            ${profile.gallery.map(photo => `
                                <img src="${supabase.storage.from('profiles').getPublicUrl(photo).data.publicUrl}" 
                                     alt="Фото з галереї" 
                                     class="gallery-item">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="modal-info">
                    <h2>${profile.name || 'Без імені'}, ${profile.age || '?'}</h2>
                    <p class="modal-location"><i class="fas fa-map-marker-alt"></i> ${profile.city || 'Не вказано'}</p>
                    ${profile.bio ? `<p class="modal-bio">${profile.bio}</p>` : ''}
                    ${profile.interests && profile.interests.length > 0 ? `
                        <div class="modal-interests">
                            <h3>Інтереси</h3>
                            <div class="interests-grid">
                                ${profile.interests.map(interest => `
                                    <span class="interest-tag">${interest}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.getElementById('profileModal').style.display = 'block';
    } catch (error) {
        console.error('Помилка завантаження профілю:', error);
        alert('Помилка завантаження профілю');
    }
};

window.closeProfileModal = () => {
    document.getElementById('profileModal').style.display = 'none';
};

// Закриття модального вікна при кліку поза ним
window.onclick = (event) => {
    const modal = document.getElementById('profileModal');
    if (event.target === modal) {
        closeProfileModal();
    }
};

window.toggleLike = async (profileId, event) => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    event.stopPropagation(); // Зупиняємо відкриття модального вікна при кліку на лайк
    alert('Функція лайків тимчасово недоступна. Спробуйте пізніше.');
};

// Ініціалізуємо при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initializeFeed);
