import { supabase } from './config.js'

let currentUser = null;

async function initializeChat() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!session?.user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = session.user;
        await loadRequests();
    } catch (error) {
        console.error('Помилка ініціалізації:', error);
    }
}

async function loadRequests() {
    const requestsContainer = document.getElementById('requestsContainer');
    
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (!session?.user) {
            requestsContainer.innerHTML = `
                <div class="auth-prompt">
                    <h3>Увійдіть, щоб побачити повідомлення</h3>
                    <p>Для перегляду повідомлень необхідно увійти в свій акаунт</p>
                    <div class="auth-buttons">
                        <a href="login.html" class="btn-primary">Увійти</a>
                        <a href="register.html" class="btn-outline">Зареєструватися</a>
                    </div>
                </div>
            `;
            return;
        }

        // Отримуємо всі матчі
        const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select('id, user1_id, user2_id, user1_liked, user2_liked, matched_at')
            .eq('user2_id', session.user.id)
            .eq('user1_liked', true)
            .is('user2_liked', null);

        if (matchesError) throw matchesError;

        if (!matches || matches.length === 0) {
            requestsContainer.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-heart"></i>
                    <h3>Поки що немає нових лайків</h3>
                    <p>Тут з'являться користувачі, які вас вподобали</p>
                </div>
            `;
            return;
        }

        // Отримуємо профілі користувачів, які поставили лайк
        const userIds = matches.map(match => match.user1_id);
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, age, city, avatar_url, telegram, instagram, facebook')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        // Створюємо мапу профілів для швидкого доступу
        const profileMap = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
        }, {});

        // Відображаємо запити
        requestsContainer.innerHTML = matches.map(match => {
            const profile = profileMap[match.user1_id];
            if (!profile) return '';

            return `
                <div class="request-card">
                    <img src="${profile.avatar_url || './images/default-avatar.png'}" 
                         alt="${profile.name}" 
                         class="request-avatar">
                    <div class="request-info">
                        <h3>${profile.name}, ${profile.age}</h3>
                        <p class="meta">${profile.city || ''}</p>
                    </div>
                    <div class="request-actions">
                        <button class="accept-btn" onclick="acceptMatch('${match.id}', '${profile.id}')">
                            <i class="fas fa-heart"></i> Взаємно
                        </button>
                        <button class="decline-btn" onclick="declineMatch('${match.id}')">
                            <i class="fas fa-times"></i> Пропустити
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Помилка завантаження запитів:', error);
        requestsContainer.innerHTML = `
            <div class="error-message">
                <h3>Помилка при завантаженні</h3>
                <p>Спробуйте оновити сторінку</p>
            </div>
        `;
    }
}

// Функції для обробки лайків
window.acceptMatch = async (matchId, userId) => {
    try {
        // Оновлюємо матч
        const { error: matchError } = await supabase
            .from('matches')
            .update({ 
                user2_liked: true,
                matched_at: new Date().toISOString()
            })
            .eq('id', matchId);

        if (matchError) throw matchError;

        // Отримуємо профіль користувача
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('name, telegram, instagram, facebook')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        // Показуємо соціальні мережі в модальному вікні
        const socialLinks = [];
        if (profile.telegram) socialLinks.push(`<a href="https://t.me/${profile.telegram}" target="_blank" class="social-link telegram"><i class="fab fa-telegram"></i> Telegram</a>`);
        if (profile.instagram) socialLinks.push(`<a href="https://instagram.com/${profile.instagram}" target="_blank" class="social-link instagram"><i class="fab fa-instagram"></i> Instagram</a>`);
        if (profile.facebook) socialLinks.push(`<a href="https://facebook.com/${profile.facebook}" target="_blank" class="social-link facebook"><i class="fab fa-facebook"></i> Facebook</a>`);

        const modalHtml = `
            <div class="match-success">
                <h3>Вітаємо! Ви можете почати спілкування з ${profile.name}</h3>
                <div class="social-links">
                    ${socialLinks.length > 0 ? socialLinks.join('') : '<p>Користувач не додав соціальні мережі</p>'}
                </div>
            </div>
        `;

        // Показуємо модальне вікно
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';
        modalContainer.innerHTML = modalHtml;
        
        // Додаємо можливість закрити модальне вікно
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                modalContainer.remove();
            }
        });
        
        document.body.appendChild(modalContainer);

        // Оновлюємо список запитів
        loadRequests();
    } catch (error) {
        console.error('Помилка при прийнятті запиту:', error);
        alert('Помилка при прийнятті запиту');
    }
};

window.declineMatch = async (matchId) => {
    try {
        const { error } = await supabase
            .from('matches')
            .update({ user2_liked: false })
            .eq('id', matchId);

        if (error) throw error;
        
        // Оновлюємо список запитів
        loadRequests();
    } catch (error) {
        console.error('Помилка при відхиленні запиту:', error);
        alert('Помилка при відхиленні запиту');
    }
};

// Ініціалізуємо при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initializeChat);