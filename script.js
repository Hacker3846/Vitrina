const firebaseConfig = {
    apiKey: "AIzaSyBH0g83qEUERiDBjgMgRnSJ-s2lvpPtkz4",
    authDomain: "vitrina-e0a00.firebaseapp.com",
    databaseURL: "https://vitrina-e0a00-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "vitrina-e0a00",
    storageBucket: "vitrina-e0a00.firebasestorage.app",
    messagingSenderId: "182787477088",
    appId: "1:182787477088:web:35827926e1e885bb0bfd05"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

function deleteEntry(id, path) {
    if (confirm("Удалить запись?")) database.ref(path + '/' + id).remove();
}

// Слушаем данные склада (Касса, Переводы, Итого)
database.ref('skladData').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const cash = data.cash || 0;
        let totalTransfer = 0;
        
        // Считаем переводы по всем клиентам
        if (data.customers) {
            data.customers.forEach(c => totalTransfer += (c.payCard || 0));
        }

        document.getElementById('total-cash').innerText = cash.toLocaleString() + " ₽";
        document.getElementById('total-transfer').innerText = totalTransfer.toLocaleString() + " ₽";
        document.getElementById('total-all').innerText = (cash + totalTransfer).toLocaleString() + " ₽";
    }
});

function updateMonitor() {
    const listElement = document.getElementById('reports-list');
    
    Promise.all([
        database.ref('monitoringOrders').once('value'),
        database.ref('reports').once('value')
    ]).then(([ordersSnap, reportsSnap]) => {
        let allEvents = [];

        // 1. Быстрые заказы
        if (ordersSnap.val()) {
            Object.keys(ordersSnap.val()).forEach(key => {
                const data = ordersSnap.val()[key];
                const itemsHtml = (data.items || []).map(it => `<span class="product-line">📦 ${it.name} x${it.qty}</span>`).join('');
                allEvents.push({
                    id: key, path: 'monitoringOrders',
                    timestamp: data.timestamp || 0,
                    time: data.time || '',
                    type: data.status === 'accepted' ? 'success' : 'danger',
                    html: `
                        <span class="client-title">👤 ${data.clientName}:</span>
                        ${itemsHtml}
                    `
                });
            });
        }

        // 2. Полные отчеты
        if (reportsSnap.val()) {
            Object.keys(reportsSnap.val()).forEach(key => {
                const data = reportsSnap.val()[key];
                // Убираем строку про "Нал", так как это дубль кассы
                const cleanText = data.reportText
                    .replace(/💵 Нал: .*\n/, '') 
                    .replace(/📦 СКЛАД:/g, 'ОСТАТКИ НА СКЛАДЕ:')
                    .replace(/👤/g, '<span class="client-title">👤') // Выделяем имя
                    .replace(/- /g, '<span class="product-line">🔹 ') // Делаем отступ товарам
                    .replace(/:/g, ':</span>'); // Закрываем заголовок имени

                allEvents.push({
                    id: key, path: 'reports',
                    timestamp: data.timestamp || 0,
                    time: new Date(data.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                    type: 'primary',
                    html: `<div class="order-body">${cleanText}</div>`
                });
            });
        }

        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        listElement.innerHTML = allEvents.map(ev => `
            <div class="report-item type-${ev.type}">
                <div class="report-header">
                    <span>⏰ ${ev.time}</span>
                    <button class="btn-del" onclick="deleteEntry('${ev.id}', '${ev.path}')">✕</button>
                </div>
                ${ev.html}
            </div>
        `).join('');
        document.getElementById('last-update').innerText = `Обновлено: ${new Date().toLocaleTimeString()}`;
    });
}

database.ref('monitoringOrders').on('value', updateMonitor);
database.ref('reports').on('value', updateMonitor);
