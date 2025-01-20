import { supabase } from './config.js';

let currentUser = null;
let currentPage = 0;
const PROFILES_PER_PAGE = 10;
let isLoading = false;
let hasMoreProfiles = true;

// Ініціалізація головної сторінки
async function initializeFeed() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;
        console.log('DOM готовий, продовжуємо ініціалізацію...');
        
        // Підписуємось на оновлення лайків
        subscribeToLikeNotifications();
        
        // Завантажуємо профілі
        await loadProfiles();
        
        // Налаштовуємо нескінченний скрол
        setupInfiniteScroll();
    } catch (error) {
        console.error('Помилка ініціалізації:', error);
    }
}

// Підписка на повідомлення про нові лайки
async function subscribeToLikeNotifications() {
    console.log('Підписуємось на оновлення лайків...');
    console.log('Поточний користувач:', currentUser);
    
    try {
        const subscription = supabase
            .channel('likes-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'likes'
                },
                async (payload) => {
                    console.log('Отримано подію INSERT для лайків:', payload);
                    // Перевіряємо чи це лайк для поточного користувача
                    if (payload.new && payload.new.profile_id === currentUser.id) {
                        console.log('Отримано новий лайк для поточного користувача');
                        await handleNewLike(payload.new);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'likes'
                },
                async (payload) => {
                    console.log('Отримано подію UPDATE для лайків:', payload);
                    // Перевіряємо чи це оновлення статусу нашого лайку
                    if (payload.new) {
                        // Якщо ми отримувач лайку і статус прийнято
                        if (payload.new.profile_id === currentUser.id && payload.new.status === 'accepted') {
                            console.log('Ваш лайк був прийнятий!');
                            const { data: likerProfile } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('id', payload.new.user_id)
                                .single();
                                
                            if (likerProfile) {
                                showContactsModal(likerProfile);
                            }
                        }
                        // Якщо ми відправник лайку і статус прийнято
                        else if (payload.new.user_id === currentUser.id && payload.new.status === 'accepted') {
                            console.log('Користувач прийняв ваш лайк!');
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('id', payload.new.profile_id)
                                .single();
                                
                            if (profile) {
                                showContactsModal(profile);
                            }
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log('Статус підписки на лайки:', status);
            });

        console.log('Підписка налаштована:', subscription);
    } catch (error) {
        console.error('Помилка при налаштуванні підписки:', error);
    }
}

// Обробка нового лайку
async function handleNewLike(like) {
    try {
        console.log('Обробляємо новий лайк:', like);
        
        // Отримуємо профіль користувача, який поставив лайк
        const { data: likerProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', like.user_id)
            .single();

        if (profileError) {
            console.error('Помилка отримання профілю користувача, який поставив лайк:', profileError);
            return;
        }

        console.log('Профіль користувача, який поставив лайк:', likerProfile);

        // Перевіряємо чи є взаємний лайк
        const { data: mutualLike, error: mutualError } = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('profile_id', like.user_id)
            .eq('status', 'pending')
            .maybeSingle();

        if (mutualError) {
            console.error('Помилка перевірки взаємного лайку:', mutualError);
            return;
        }

        console.log('Взаємний лайк:', mutualLike);

        if (mutualLike) {
            console.log('Це взаємний лайк! Показуємо модальне вікно для підтвердження...');
            showLikeRequestModal(likerProfile);
        } else {
            console.log('Отримано новий лайк');
            // Показуємо нотифікацію про новий лайк
            const notification = `${likerProfile.name} вподобав(ла) ваш профіль!`;
            alert(notification);
        }
    } catch (error) {
        console.error('Помилка обробки нового лайку:', error);
    }
}

// Показ модального вікна з пропозицією
function showLikeRequestModal(likerProfile) {
    const modalHTML = `
        <div class="like-request-modal">
            <div class="like-request-content">
                <h2>Взаємна симпатія! 💕</h2>
                <p>Ви сподобались один одному з користувачем ${likerProfile.name}!</p>
                <p>Хочете обмінятися контактами?</p>
                <div class="like-request-buttons">
                    <button onclick="handleLikeResponse('${likerProfile.id}', true)" class="accept-like">
                        Так, обмінятися контактами
                    </button>
                    <button onclick="handleLikeResponse('${likerProfile.id}', false)" class="reject-like">
                        Ні, дякую
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Обробка відповіді на лайк
window.handleLikeResponse = async (likerId, accepted) => {
    try {
        // Оновлюємо статус лайку
        const { error: updateError } = await supabase
            .from('likes')
            .update({ 
                status: accepted ? 'accepted' : 'declined' 
            })
            .eq('user_id', likerId)
            .eq('profile_id', currentUser.id);

        if (updateError) {
            console.error('Помилка при оновленні статусу:', updateError);
            throw updateError;
        }

        if (accepted) {
            // Отримуємо профілі обох користувачів
            const [{ data: likerProfile }, { data: myProfile }] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', likerId).single(),
                supabase.from('profiles').select('*').eq('id', currentUser.id).single()
            ]);

            if (!likerProfile || !myProfile) {
                throw new Error('Не вдалося отримати профілі користувачів');
            }

            // Показуємо контакти
            showContactsModal(likerProfile, myProfile);
        }

        // В будь-якому випадку закриваємо модальне вікно
        const modal = document.querySelector('.like-request-modal');
        if (modal) {
            modal.remove();
        }
    } catch (error) {
        console.error('Помилка при обробці відповіді на лайк:', error);
        alert('Помилка при обробці відповіді. Спробуйте ще раз.');
    }
};

// Функція для обробки лайків
window.toggleLike = async (profileId, event) => {
    if (event) {
        event.stopPropagation();
    }
    
    try {
        // Перевіряємо чи не лайкаємо самі себе
        if (profileId === currentUser.id) {
            console.log('Не можна лайкати самого себе');
            return;
        }

        const likeButton = document.querySelector(`[onclick="toggleLike('${profileId}', event)"]`);
        if (likeButton) {
            likeButton.disabled = true;
        }

        // Перевіряємо чи вже є лайк
        const { data: existingLike, error: likeError } = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('profile_id', profileId)
            .maybeSingle();

        if (likeError) {
            console.error('Помилка при перевірці лайку:', likeError);
            throw likeError;
        }

        if (existingLike) {
            console.log('Лайк вже існує');
            if (likeButton) {
                likeButton.disabled = false;
                likeButton.classList.add('liked');
                likeButton.innerHTML = '<i class="fas fa-heart"></i> Вподобано';
            }
            return;
        }

        // Додаємо новий лайк
        const { error: insertError } = await supabase
            .from('likes')
            .insert([
                {
                    user_id: currentUser.id,
                    profile_id: profileId,
                    status: 'pending'
                }
            ]);

        if (insertError) throw insertError;

        // Отримуємо інформацію про поточного користувача для повідомлення
        const { data: myProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profileError) throw profileError;

        // Створюємо повідомлення для отримувача лайку
        const { error: messageError } = await supabase
            .from('messages')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: profileId,
                    content: `Користувач вподобав ваш профіль`,
                    created_at: new Date().toISOString()
                }
            ]);

        if (messageError) {
            console.error('Помилка при створенні повідомлення:', messageError);
            // Не викидаємо помилку, щоб не блокувати функціонал лайків
        }

        if (likeButton) {
            likeButton.disabled = false;
            likeButton.classList.add('liked');
            likeButton.innerHTML = '<i class="fas fa-heart"></i> Вподобано';
        }
    } catch (error) {
        console.error('Помилка при додаванні лайку:', error);
    } finally {
        const likeButton = document.querySelector(`[onclick="toggleLike('${profileId}', event)"]`);
        if (likeButton) {
            likeButton.disabled = false;
        }
    }
};

// Показ модального вікна з контактами
function showContactsModal(likerProfile, myProfile) {
    const modalHTML = `
        <div class="contacts-modal">
            <div class="contacts-content">
                <h2>Обмін контактами</h2>
                <div class="profiles-contacts">
                    <div class="profile-contacts">
                        <h3>${likerProfile.name}</h3>
                        <div class="contact-links">
                            ${likerProfile.telegram ? `
                                <a href="https://t.me/${likerProfile.telegram}" target="_blank" class="contact-link telegram">
                                    <i class="fab fa-telegram"></i> Telegram
                                </a>
                            ` : ''}
                            ${likerProfile.instagram ? `
                                <a href="https://instagram.com/${likerProfile.instagram}" target="_blank" class="contact-link instagram">
                                    <i class="fab fa-instagram"></i> Instagram
                                </a>
                            ` : ''}
                            ${likerProfile.facebook ? `
                                <a href="https://facebook.com/${likerProfile.facebook}" target="_blank" class="contact-link facebook">
                                    <i class="fab fa-facebook"></i> Facebook
                                </a>
                            ` : ''}
                        </div>
                    </div>
                    <div class="profile-contacts">
                        <h3>Ваші контакти</h3>
                        <div class="contact-links">
                            ${myProfile.telegram ? `
                                <a href="https://t.me/${myProfile.telegram}" target="_blank" class="contact-link telegram">
                                    <i class="fab fa-telegram"></i> Telegram
                                </a>
                            ` : ''}
                            ${myProfile.instagram ? `
                                <a href="https://instagram.com/${myProfile.instagram}" target="_blank" class="contact-link instagram">
                                    <i class="fab fa-instagram"></i> Instagram
                                </a>
                            ` : ''}
                            ${myProfile.facebook ? `
                                <a href="https://facebook.com/${myProfile.facebook}" target="_blank" class="contact-link facebook">
                                    <i class="fab fa-facebook"></i> Facebook
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <button onclick="closeContactsModal()" class="close-contacts">
                    <i class="fas fa-times"></i> Закрити
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Закриття модального вікна з контактами
window.closeContactsModal = () => {
    const modal = document.querySelector('.contacts-modal');
    if (modal) {
        modal.remove();
    }
};

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

// Завантаження профілів
async function loadProfiles() {
    if (isLoading || !hasMoreProfiles) return;

    try {
        isLoading = true;
        const loader = document.getElementById('profilesLoader');
        if (loader) loader.style.display = 'flex';

        // Отримуємо вже лайкнуті профілі
        const { data: likedProfiles } = await supabase
            .from('likes')
            .select('profile_id')
            .eq('user_id', currentUser.id);

        const likedProfileIds = new Set(likedProfiles?.map(like => like.profile_id) || []);

        // Отримуємо профілі з пагінацією
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', currentUser.id)
            .range(currentPage * PROFILES_PER_PAGE, (currentPage + 1) * PROFILES_PER_PAGE - 1)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!profiles || profiles.length === 0) {
            hasMoreProfiles = false;
            if (currentPage === 0) {
                const container = document.getElementById('profilesContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="no-profiles">
                            <i class="fas fa-user-friends"></i>
                            <h3>Поки що немає анкет</h3>
                            <p>Спробуйте зайти пізніше</p>
                        </div>
                    `;
                }
            }
            return;
        }

        const container = document.getElementById('profilesContainer');
        if (!container) return;

        const profilesHTML = profiles.map(profile => {
            const isLiked = likedProfileIds.has(profile.id);
            const avatarUrl = profile.avatar_url 
                ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl 
                : './images/default-avatar.png';

            // Обмежуємо кількість інтересів для відображення
            const interests = profile.interests || [];
            const displayedInterests = interests.slice(0, 3);
            const hasMoreInterests = interests.length > 3;

            return `
                <div class="profile-card">
                    <div class="profile-preview">
                        <img src="${avatarUrl}" alt="${profile.name}" class="profile-avatar">
                        <div class="profile-info">
                            <h3 class="profile-name">
                                ${profile.name} <span class="age">${profile.age || '?'}</span>
                            </h3>
                            <div class="profile-location">
                                <i class="fas fa-map-marker-alt"></i>
                                ${profile.city || 'Не вказано'}
                            </div>
                        </div>
                    </div>
                    <div class="profile-details">
                        <div class="profile-bio">
                            ${profile.about || 'Користувач поки що не додав опис'}
                        </div>
                        <div class="profile-interests">
                            ${displayedInterests.map(interest => `
                                <span class="interest-tag">${interest}</span>
                            `).join('')}
                            ${hasMoreInterests ? `
                                <span class="interest-tag">+${interests.length - 3}</span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button onclick="showProfileModal('${profile.id}')" class="action-button info-button">
                            <i class="fas fa-info"></i>
                        </button>
                        <button onclick="toggleLike('${profile.id}', event)" class="action-button like-button ${isLiked ? 'liked' : ''}">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (currentPage === 0) {
            container.innerHTML = profilesHTML;
        } else {
            container.insertAdjacentHTML('beforeend', profilesHTML);
        }

        currentPage++;

    } catch (error) {
        console.error('Помилка завантаження профілів:', error);
        const container = document.getElementById('profilesContainer');
        if (container && currentPage === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Помилка завантаження</h3>
                    <p>Спробуйте оновити сторінку</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
        const loader = document.getElementById('profilesLoader');
        if (loader) loader.style.display = 'none';
    }
}

// Налаштування нескінченного скролу
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

// Показ модального вікна з профілем
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
                        supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl 
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

// Закриття модального вікна з профілем
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

// Ініціалізуємо при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initializeFeed);
