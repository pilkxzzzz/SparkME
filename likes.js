document.addEventListener('DOMContentLoaded', () => {
    const likesContainer = document.getElementById('likesContainer');
    
    // Тестові дані для лайків (в реальному проекті будуть приходити з сервера)
    const sampleLikes = [
        {
            id: 1,
            name: "Олена",
            age: 25,
            city: "Київ",
            image: "./images/default-avatar.png",
            likedAt: "2024-02-20"
        },
        {
            id: 2,
            name: "Михайло",
            age: 28,
            city: "Львів",
            image: "./images/default-avatar.png",
            likedAt: "2024-02-19"
        }
    ];

    // Функція для створення картки лайка
    function createLikeCard(like) {
        const card = document.createElement('div');
        card.className = 'like-card';
        card.innerHTML = `
            <img src="${like.image}" alt="${like.name}">
            <h3>${like.name}, ${like.age}</h3>
            <p class="meta">${like.city}</p>
            <div class="like-actions">
                <button class="like-back-btn" onclick="likePerson(${like.id})">
                    <i class="fas fa-heart"></i> Лайкнути
                </button>
                <button class="message-btn" onclick="messagePerson(${like.id})">
                    <i class="fas fa-comment"></i> Написати
                </button>
            </div>
        `;
        return card;
    }

    // Відображення лайків
    sampleLikes.forEach(like => {
        likesContainer.appendChild(createLikeCard(like));
    });

    // Функції для обробки дій
    window.likePerson = (id) => {
        alert('Функція лайку в розробці');
    };

    window.messagePerson = (id) => {
        alert('Функція повідомлень в розробці');
    };
}); 