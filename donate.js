export function donate(amount) {
    // В реальному проекті тут буде інтеграція з платіжною системою
    alert(`Дякуємо за бажання підтримати проект на $${amount}! На жаль, це лише демо-версія.`);
}

export function donateCustom() {
    const amount = document.getElementById('customAmount').value;
    if (amount && amount > 0) {
        donate(amount);
    } else {
        alert('Будь ласка, введіть коректну суму');
    }
}

// Робимо функції доступними глобально
window.donate = donate
window.donateCustom = donateCustom 