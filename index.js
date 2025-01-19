import { supabase } from './config.js';

let currentUser = null;

async function initializeFeed() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!session?.user) {
            showAuthPrompt();
            return;
        }

        currentUser = session.user;
        await loadProfiles();
    } catch (error) {
        console.error('Помилка ініціалізації:', error);
    }
}

function showAuthPrompt() {
    const profilesContainer = document.getElementById('profilesContainer');
    profilesContainer.innerHTML = `
        <div class="auth-prompt">
            <h3>Увійдіть, щоб побачити анкети</h3>
            <p>Для перегляду анкет необхідно увійти в свій акаунт</p>
            <div class="auth-buttons">
                <a href="login.html" class="btn-primary">Увійти</a>
                <a href="register.html" class="btn-outline">Зареєструватися</a>
            </div>
        </div>
    `;
}

async function loadProfiles() {
    const profilesContainer = document.getElementById('profilesContainer');
    
    try {
        // Отримуємо профіль поточного користувача для фільтрації за статтю
        const { data: currentProfile, error: profileError } = await supabase
            .from('profiles')
            .select('gender')
            .eq('id', currentUser.id)
            .single();

        if (profileError) throw profileError;

        // Визначаємо протилежну стать
        const targetGender = currentProfile.gender === 'male' ? 'female' : 'male';

        // Отримуємо існуючі лайки користувача
        const { data: existingMatches, error: matchesError } = await supabase
            .from('matches')
            .select('user2_id')
            .eq('user1_id', currentUser.id);

        if (matchesError) throw matchesError;

        // Створюємо масив ID користувачів, яких вже лайкнули
        const likedUserIds = existingMatches.map(match => match.user2_id);

        // Отримуємо профілі протилежної статі, яких ще не лайкали
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .eq('gender', targetGender)
            .not('id', 'in', `(${[currentUser.id, ...likedUserIds].join(',')})`)
            .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        if (!profiles || profiles.length === 0) {
            profilesContainer.innerHTML = `
                <div class="no-profiles">
                    <i class="fas fa-heart-broken"></i>
                    <h3>Анкет більше немає</h3>
                    <p>Спробуйте зайти пізніше</p>
                </div>
            `;
            return;
        }

        // Відображаємо профілі
        profilesContainer.innerHTML = profiles.map(profile => `
            <div class="profile-card">
                <div class="profile-photos">
                    <img src="${profile.avatar_url || './images/default-avatar.png'}" 
                         alt="${profile.name}" 
                         class="profile-photo">
                </div>
                <div class="profile-info">
                    <h3>${profile.name}, ${profile.age}</h3>
                    <p class="location"><i class="fas fa-map-marker-alt"></i> ${profile.city || 'Не вказано'}</p>
                    ${profile.bio ? `<p class="bio">${profile.bio}</p>` : ''}
                    ${profile.interests && profile.interests.length > 0 ? `
                        <div class="interests">
                            ${profile.interests.map(interest => `
                                <span class="interest-tag">${interest}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="profile-actions">
                    <button onclick="likeProfile('${profile.id}')" class="like-btn">
                        <i class="fas fa-heart"></i> Подобається
                    </button>
                    <button onclick="skipProfile('${profile.id}')" class="skip-btn">
                        <i class="fas fa-times"></i> Пропустити
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Помилка завантаження профілів:', error);
        profilesContainer.innerHTML = `
            <div class="error-message">
                <h3>Помилка при завантаженні</h3>
                <p>Спробуйте оновити сторінку</p>
            </div>
        `;
    }
}

window.likeProfile = async (userId) => {
    try {
        // Створюємо новий матч
        const { error } = await supabase
            .from('matches')
            .insert({
                user1_id: currentUser.id,
                user2_id: userId,
                user1_liked: true
            });

        if (error) throw error;

        // Оновлюємо список профілів
        await loadProfiles();
    } catch (error) {
        console.error('Помилка при лайку профілю:', error);
        alert('Помилка при лайку профілю');
    }
};

window.skipProfile = async (userId) => {
    try {
        // Створюємо новий матч з user1_liked = false
        const { error } = await supabase
            .from('matches')
            .insert({
                user1_id: currentUser.id,
                user2_id: userId,
                user1_liked: false
            });

        if (error) throw error;

        // Оновлюємо список профілів
        await loadProfiles();
    } catch (error) {
        console.error('Помилка при пропуску профілю:', error);
        alert('Помилка при пропуску профілю');
    }
};

// Функції для модального вікна
function checkFirstVisit() {
    if (!localStorage.getItem('hasVisitedBefore')) {
        showWelcomeModal();
        localStorage.setItem('hasVisitedBefore', 'true');
    }
}

function showWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    modal.classList.add('show');
}

window.closeWelcomeModal = function() {
    const modal = document.getElementById('welcomeModal');
    modal.classList.remove('show');
};

window.goToDonate = function() {
    window.location.href = 'donate.html';
};

// Ініціалізуємо при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    initializeFeed();
    checkFirstVisit();
});
