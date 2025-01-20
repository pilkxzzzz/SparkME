import { supabase } from './config.js'

let currentUser = null;
let isLoading = false;
let initializationAttempts = 0;
const MAX_ATTEMPTS = 50;

// Функція для перевірки готовності DOM
function isDOMReady() {
    const messagesList = document.getElementById('messagesList');
    const requestsContainer = document.getElementById('requestsContainer');
    
    if (!messagesList || !requestsContainer) {
        console.log('Очікування елементів DOM:', {
            messagesList: !!messagesList,
            requestsContainer: !!requestsContainer
        });
        return false;
    }
    return true;
}

async function initializeMessages() {
    try {
        // Чекаємо поки DOM буде готовий
        if (!isDOMReady()) {
            initializationAttempts++;
            if (initializationAttempts < MAX_ATTEMPTS) {
                console.log(`Спроба ${initializationAttempts}/${MAX_ATTEMPTS}: DOM не готовий, чекаємо...`);
                setTimeout(initializeMessages, 100);
                return;
            } else {
                throw new Error('Перевищено максимальну кількість спроб ініціалізації');
            }
        }

        console.log('DOM готовий, продовжуємо ініціалізацію...');

        // Отримуємо користувача
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) throw userError;
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;
        console.log('Користувач авторизований:', currentUser);

        // Завантажуємо повідомлення
        await loadMessages();
        
        // Підписуємося на нові повідомлення
        subscribeToMessages();
        
        // Оновлюємо лічильник непрочитаних
        updateUnreadCount();
    } catch (error) {
        console.error('Помилка ініціалізації:', error);
        const messagesList = document.getElementById('messagesList');
        if (messagesList) {
            showError('Помилка ініціалізації. Спробуйте оновити сторінку.');
        }
    }
}

async function loadMessages() {
    if (isLoading || !currentUser) return;
    
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) {
        console.error('Елемент messagesList не знайдено');
        return;
    }

    try {
        isLoading = true;
        showLoader();

        // Отримуємо повідомлення з профілями відправників
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                created_at,
                read_at,
                sender_id,
                receiver_id,
                profiles!fk_sender(
                    name,
                    avatar_url,
                    telegram,
                    instagram,
                    facebook
                )
            `)
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (messagesError) {
            console.error('Помилка завантаження повідомлень:', messagesError);
            throw messagesError;
        }

        // Оновлюємо статус прочитання для всіх нових повідомлень
        const unreadMessages = messages.filter(msg => !msg.read_at);
        if (unreadMessages.length > 0) {
            const { error: updateError } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .in('id', unreadMessages.map(msg => msg.id));

            if (updateError) {
                console.error('Помилка оновлення статусу повідомлень:', updateError);
            }
        }

        if (!messages || messages.length === 0) {
            messagesList.innerHTML = '<div class="no-messages">У вас поки немає повідомлень</div>';
            return;
        }

        messagesList.innerHTML = messages.map(message => {
            const sender = message.profiles || {};
            return `
                <div class="message-item ${message.read_at ? '' : 'unread'}" data-message-id="${message.id}">
                    <div class="message-avatar">
                        <img src="${sender.avatar_url ? 
                            supabase.storage.from('avatars').getPublicUrl(sender.avatar_url).data.publicUrl 
                            : '/images/default-avatar.png'}" 
                            alt="${sender.name || 'Користувач'}">
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <h3>${sender.name || 'Користувач'}</h3>
                            <span class="message-time">${formatDate(message.created_at)}</span>
                        </div>
                        ${renderMessageContent(message, sender)}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
        messagesList.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Помилка завантаження повідомлень. Спробуйте оновити сторінку.</p>
            </div>
        `;
    } finally {
        isLoading = false;
        hideLoader();
    }
}

function renderMessageContent(message, sender) {
    if (message.content === 'like_request') {
        return `
            <div class="message-text">
                <div class="like-request-header">
                    <img src="${message.metadata?.sender_avatar || 'default-avatar.png'}" alt="Avatar" class="sender-avatar">
                    <p><strong>${message.metadata?.sender_name || 'Користувач'}</strong> хоче познайомитись з вами!</p>
                </div>
                ${!message.read_at ? `
                    <div class="message-actions">
                        <button onclick="handleLikeResponse('${message.sender_id}', true, '${message.id}')" class="accept-button">
                            <i class="fas fa-check"></i> Прийняти
                        </button>
                        <button onclick="handleLikeResponse('${message.sender_id}', false, '${message.id}')" class="decline-button">
                            <i class="fas fa-times"></i> Відхилити
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    } else if (message.content === 'like_accepted') {
        return `
            <div class="message-text">
                <p><strong>${sender.name}</strong> прийняв(ла) ваш запит на знайомство!</p>
                <p>Тепер ви можете зв'язатися через:</p>
                <div class="social-links">
                    ${sender.telegram ? `
                        <a href="https://t.me/${sender.telegram.replace('@', '')}" target="_blank" class="social-link">
                            <i class="fab fa-telegram"></i> Telegram
                        </a>
                    ` : ''}
                    ${sender.instagram ? `
                        <a href="https://instagram.com/${sender.instagram}" target="_blank" class="social-link">
                            <i class="fab fa-instagram"></i> Instagram
                        </a>
                    ` : ''}
                    ${sender.facebook ? `
                        <a href="${sender.facebook}" target="_blank" class="social-link">
                            <i class="fab fa-facebook"></i> Facebook
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    } else if (message.content === 'like_declined') {
        return `
            <div class="message-text">
                <p><strong>${sender.name}</strong> відхилив(ла) ваш запит на знайомство.</p>
            </div>
        `;
    }
    return `<div class="message-text"><p>${message.content}</p></div>`;
}

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
    if (!requestsContainer || !currentUser) return;

    try {
        // Отримуємо всі отримані лайки зі статусом 'pending'
        const { data: likes, error: likesError } = await supabase
            .from('likes')
            .select(`
                *,
                profiles:user_id (
                    id,
                    name,
                    age,
                    avatar_url,
                    city,
                    telegram,
                    instagram,
                    facebook
                )
            `)
            .eq('profile_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (likesError) throw likesError;

        if (!likes || likes.length === 0) {
            requestsContainer.innerHTML = `
                <div class="no-requests-message">
                    <i class="fas fa-heart-broken"></i>
                    <p>Поки що немає нових лайків</p>
                </div>
            `;
            return;
        }

        // Очищаємо старий заголовок, якщо він є
        const oldTitle = requestsContainer.querySelector('.no-requests-message');
        if (oldTitle) {
            oldTitle.remove();
        }

        // Відображаємо кожен лайк
        const requestsHTML = likes.map(like => `
            <div class="request-card" id="request-${like.id}">
                <div class="request-profile">
                    <img src="${like.profiles.avatar_url ? 
                        supabase.storage.from('avatars').getPublicUrl(like.profiles.avatar_url).data.publicUrl 
                        : 'default-avatar.png'}" 
                        alt="${like.profiles.name}" 
                        class="request-avatar">
                    <div class="request-info">
                        <h3>${like.profiles.name}, ${like.profiles.age || '?'}</h3>
                        <p><i class="fas fa-map-marker-alt"></i> ${like.profiles.city || 'Не вказано'}</p>
                        <p class="request-time">${formatDate(like.created_at)}</p>
                    </div>
                </div>
                <div class="request-actions">
                    <button onclick="handleLikeResponse('${like.user_id}', true, '${like.id}')" class="accept-request">
                        <i class="fas fa-check"></i> Прийняти
                    </button>
                    <button onclick="handleLikeResponse('${like.user_id}', false, '${like.id}')" class="decline-request">
                        <i class="fas fa-times"></i> Відхилити
                    </button>
                </div>
            </div>
        `).join('');

        requestsContainer.innerHTML = requestsHTML;

    } catch (error) {
        console.error('Помилка завантаження запитів:', error);
        requestsContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Помилка завантаження запитів</p>
            </div>
        `;
    }
}

window.handleLikeResponse = async (likerId, accepted, requestId) => {
    try {
        // Оновлюємо статус лайку
        const { error: updateError } = await supabase
            .from('likes')
            .update({ 
                status: accepted ? 'accepted' : 'declined'
            })
            .eq('user_id', likerId)
            .eq('profile_id', currentUser.id);

        if (updateError) throw updateError;

        // Видаляємо картку запиту з DOM
        const requestCard = document.getElementById(`request-${requestId}`);
        if (requestCard) {
            requestCard.remove();
        }

        // Перевіряємо чи залишились ще запити
        const requestsContainer = document.getElementById('requestsContainer');
        if (requestsContainer && !requestsContainer.children.length) {
            requestsContainer.innerHTML = `
                <div class="no-requests-message">
                    <i class="fas fa-heart-broken"></i>
                    <p>Поки що немає нових лайків</p>
                </div>
            `;
        }

        if (accepted) {
            // Отримуємо профіль користувача, який поставив лайк
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', likerId)
                .single();

            if (profile) {
                showMatchModal(profile);
            }
        }

    } catch (error) {
        console.error('Помилка при обробці відповіді на лайк:', error);
        alert('Помилка при обробці відповіді. Спробуйте ще раз.');
    }
};

function showMatchModal(profile) {
    const modalHTML = `
        <div class="match-modal">
            <div class="match-content">
                <h2>🎉 Це взаємна симпатія!</h2>
                <p>Ви можете обмінятися контактами з ${profile.name}!</p>
                <div class="contact-info">
                    ${profile.telegram ? `
                        <a href="https://t.me/${profile.telegram}" target="_blank" class="contact-link telegram">
                            <i class="fab fa-telegram"></i> ${profile.telegram}
                        </a>
                    ` : ''}
                    ${profile.instagram ? `
                        <a href="https://instagram.com/${profile.instagram}" target="_blank" class="contact-link instagram">
                            <i class="fab fa-instagram"></i> ${profile.instagram}
                        </a>
                    ` : ''}
                    ${profile.facebook ? `
                        <a href="https://facebook.com/${profile.facebook}" target="_blank" class="contact-link facebook">
                            <i class="fab fa-facebook"></i> ${profile.facebook}
                        </a>
                    ` : ''}
                    ${!profile.telegram && !profile.instagram && !profile.facebook ? `
                        <p class="no-contacts">Користувач поки що не додав контакти 😔</p>
                    ` : ''}
                </div>
                <div class="match-actions">
                    <button onclick="closeMatchModal()" class="close-match">Закрити</button>
                    <button onclick="showUserProfile('${profile.id}')" class="view-profile">
                        <i class="fas fa-user"></i> Переглянути профіль
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.showUserProfile = async (userId) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Закриваємо модальне вікно матчу
        closeMatchModal();

        // Показуємо модальне вікно з повним профілем
        const modalHTML = `
            <div class="profile-modal">
                <div class="profile-content">
                    <div class="profile-header">
                        <img src="${profile.avatar_url ? 
                            supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl 
                            : '/images/default-avatar.png'}" 
                            alt="${profile.name}" 
                            class="profile-avatar">
                        <div class="profile-info">
                            <h2>${profile.name}, ${profile.age || '?'}</h2>
                            <p><i class="fas fa-map-marker-alt"></i> ${profile.city || 'Не вказано'}</p>
                        </div>
                    </div>
                    ${profile.about ? `
                        <div class="profile-about">
                            <h3>Про мене</h3>
                            <p>${profile.about}</p>
                        </div>
                    ` : ''}
                    <div class="profile-contacts">
                        <h3>Контакти</h3>
                        <div class="contact-links">
                            ${profile.telegram ? `
                                <a href="https://t.me/${profile.telegram}" target="_blank" class="contact-link telegram">
                                    <i class="fab fa-telegram"></i> ${profile.telegram}
                                </a>
                            ` : ''}
                            ${profile.instagram ? `
                                <a href="https://instagram.com/${profile.instagram}" target="_blank" class="contact-link instagram">
                                    <i class="fab fa-instagram"></i> ${profile.instagram}
                                </a>
                            ` : ''}
                            ${profile.facebook ? `
                                <a href="https://facebook.com/${profile.facebook}" target="_blank" class="contact-link facebook">
                                    <i class="fab fa-facebook"></i> ${profile.facebook}
                                </a>
                            ` : ''}
                            ${!profile.telegram && !profile.instagram && !profile.facebook ? `
                                <p class="no-contacts">Користувач поки що не додав контакти 😔</p>
                            ` : ''}
                        </div>
                    </div>
                    <button onclick="closeProfileModal()" class="close-profile">
                        <i class="fas fa-times"></i> Закрити
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Помилка при завантаженні профілю:', error);
        alert('Помилка при завантаженні профілю. Спробуйте ще раз.');
    }
};

window.closeMatchModal = () => {
    const modal = document.querySelector('.match-modal');
    if (modal) {
        modal.remove();
    }
};

window.closeProfileModal = () => {
    const modal = document.querySelector('.profile-modal');
    if (modal) {
        modal.remove();
    }
};

async function subscribeToMessages() {
    const channel = supabase
        .channel('public:messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${currentUser.id}`
        }, () => {
            loadMessages();
            updateUnreadCount();
        })
        .subscribe();
}

async function updateUnreadCount() {
    try {
        const badge = document.getElementById('unreadCount');
        if (!badge) return; // Якщо елемент не знайдено, просто виходимо

        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .is('read_at', null);

        if (error) throw error;

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Помилка оновлення лічильника:', error);
    }
}

async function markMessageAsRead(messageId) {
    try {
        const { error } = await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', messageId);

        if (error) throw error;
        
        updateUnreadCount();
    } catch (error) {
        console.error('Помилка позначення повідомлення як прочитане:', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Менше 24 годин
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    }
    // Менше 7 днів
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString('uk-UA', { weekday: 'long' });
    }
    // Більше 7 днів
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
}

function showLoader() {
    const loader = document.getElementById('messagesLoader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('messagesLoader');
    if (loader) loader.style.display = 'none';
}

function showError(message) {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

// Ініціалізуємо сторінку при завантаженні
document.addEventListener('DOMContentLoaded', initializeMessages);
document.addEventListener('DOMContentLoaded', initializeChat);