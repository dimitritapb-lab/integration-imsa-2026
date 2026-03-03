(function() {
    if (sessionStorage.getItem('adminAuth') !== 'imsa2026ok') {
        document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
             background:linear-gradient(135deg,#667eea,#764ba2);font-family:Inter,sans-serif;">
            <div style="background:white;border-radius:20px;padding:50px 40px;max-width:400px;
                        width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);">
                <div style="font-size:3em;margin-bottom:15px;">🔐</div>
                <h2 style="color:#1a1c2c;margin-bottom:8px;">Accès Administration</h2>
                <p style="color:#888;margin-bottom:28px;font-size:.95em;">Entrez le mot de passe pour continuer</p>
                <input type="password" id="directPwd" placeholder="Mot de passe..."
                    style="width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:10px;
                           font-size:1em;text-align:center;letter-spacing:4px;margin-bottom:12px;"
                    onkeydown="if(event.key==='Enter') directLogin()">
                <button onclick="directLogin()" style="width:100%;padding:14px;
                    background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;
                    border-radius:10px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:12px;">
                    🔓 Accéder
                </button>
                <div id="directErr" style="color:#f44336;font-size:.9em;min-height:20px;font-weight:600;"></div>
                <a href="index.html" style="display:block;margin-top:20px;color:#667eea;font-size:.9em;text-decoration:none;">
                    ← Retour au site de réservation
                </a>
            </div>
        </div>`;
        window.directLogin = function() {
            if (document.getElementById('directPwd').value === 'imsa2026admin') {
                sessionStorage.setItem('adminAuth', 'imsa2026ok');
                location.reload();
            } else {
                document.getElementById('directErr').textContent = '❌ Mot de passe incorrect';
                document.getElementById('directPwd').value = '';
                document.getElementById('directPwd').focus();
            }
        };
    }
})();

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    itemsPerPage: 15,
    totalPlaces: 200,
    currency: 'XAF'
};

// ============================================================
// ÉTAT
// ============================================================
let state = {
    bookings: [],
    filteredBookings: [],
    currentPage: 1,
    sortColumn: 'date',
    sortDirection: 'desc',
    selectedBookings: new Set(),
    searchTimeout: null,
    qrScanner: null,
    charts: {}
};

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    loadBookings();
    setupEventListeners();
    updateLastUpdateTime();
    setInterval(refreshData, 30000);
});

// ============================================================
// CHARGEMENT DES RÉSERVATIONS
// ============================================================
function loadBookings() {
    try {
        const saved = localStorage.getItem('bookings');
        state.bookings = saved ? JSON.parse(saved) : [];
        if (state.bookings.length === 0) addSampleData();
        applyFilters();
        updateStatistics();
        updateCharts();
        displayBookings();
    } catch(e) {
        console.error('Erreur chargement:', e);
        showNotification('Erreur lors du chargement des données', 'error');
    }
}

// Données d'exemple si localStorage vide
function addSampleData() {
    const samples = [
        { id:'IMSA-001', name:'Jean Dupont', email:'jean.dupont@etudiant.fr', studentId:'IMSA25L_001', phone:'062111222', department:'info', year:'3', ticketType:'vip', tshirt:true, drink:true, total:10000, date:'2026-02-10T10:30:00', validated:true },
        { id:'IMSA-002', name:'Marie Obame', email:'marie.obame@etudiant.fr', studentId:'IMSA25L_002', phone:'074222333', department:'gestion', year:'2', ticketType:'repas', tshirt:false, drink:true, total:6000, date:'2026-02-12T14:15:00', validated:true },
        { id:'IMSA-003', name:'Pierre Mba', email:'pierre.mba@etudiant.fr', studentId:'IMSA25L_003', phone:'066333444', department:'marketing', year:'4', ticketType:'simple', tshirt:false, drink:false, total:2000, date:'2026-02-14T09:00:00', validated:false },
        { id:'IMSA-004', name:'Sophie Nze', email:'sophie.nze@etudiant.fr', studentId:'IMSA25L_004', phone:'077444555', department:'rh', year:'1', ticketType:'repas', tshirt:true, drink:false, total:7000, date:'2026-02-15T11:30:00', validated:false },
        { id:'IMSA-005', name:'Luc Engone', email:'luc.engone@etudiant.fr', studentId:'IMSA25L_005', phone:'065555666', department:'compta', year:'5', ticketType:'vip', tshirt:true, drink:true, total:10000, date:'2026-02-16T16:00:00', validated:true }
    ];
    state.bookings = samples;
    localStorage.setItem('bookings', JSON.stringify(samples));
}

// ============================================================
// STATISTIQUES
// ============================================================
function updateStatistics() {
    const total    = state.filteredBookings.length;
    const validated = state.filteredBookings.filter(b => b.validated).length;
    const revenue  = state.filteredBookings.reduce((s, b) => s + (b.total || 0), 0);

    document.getElementById('totalBookings').textContent  = total;
    document.getElementById('availablePlaces').textContent = Math.max(0, CONFIG.totalPlaces - state.bookings.length);
    document.getElementById('validatedCount').textContent  = validated;
    document.getElementById('pendingCount').textContent    = total - validated;
    document.getElementById('totalRevenue').textContent    = revenue.toLocaleString('fr-FR') + ' ' + CONFIG.currency;
}

// ============================================================
// GRAPHIQUES
// ============================================================
function updateCharts() {
    // Billet
    const tCtx = document.getElementById('ticketChart').getContext('2d');
    const tCounts = {
        simple: state.filteredBookings.filter(b => b.ticketType === 'simple').length,
        repas:  state.filteredBookings.filter(b => b.ticketType === 'repas').length,
        vip:    state.filteredBookings.filter(b => b.ticketType === 'vip').length
    };
    if (state.charts.ticket) state.charts.ticket.destroy();
    state.charts.ticket = new Chart(tCtx, {
        type: 'doughnut',
        data: {
            labels: ['Simple', 'Avec repas', 'VIP'],
            datasets: [{ data: [tCounts.simple, tCounts.repas, tCounts.vip],
                backgroundColor: ['#4CAF50','#ff9800','#e91e63'], borderWidth: 2 }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{ size:11 } } } } }
    });

    // Filières
    const dCtx = document.getElementById('departmentChart').getContext('2d');
    const dCounts = {};
    state.filteredBookings.forEach(b => { dCounts[b.department] = (dCounts[b.department]||0)+1; });
    if (state.charts.dept) state.charts.dept.destroy();
    state.charts.dept = new Chart(dCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(dCounts).map(getDepartmentName),
            datasets: [{ label: 'Inscrits', data: Object.values(dCounts),
                backgroundColor: '#667eea', borderRadius: 6 }]
        },
        options: { responsive:true, maintainAspectRatio:false,
            scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } },
            plugins:{ legend:{ display:false } } }
    });
}

// ============================================================
// AFFICHAGE DU TABLEAU
// ============================================================
function displayBookings() {
    const start = (state.currentPage - 1) * CONFIG.itemsPerPage;
    const page  = state.filteredBookings.slice(start, start + CONFIG.itemsPerPage);
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:#aaa;">
            <i class="fas fa-inbox" style="font-size:2em;display:block;margin-bottom:10px;"></i>
            Aucune réservation trouvée</td></tr>`;
        updatePagination();
        return;
    }

    page.forEach(b => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="booking-checkbox" value="${b.id}" ${state.selectedBookings.has(b.id)?'checked':''}></td>
            <td><strong>${b.name}</strong></td>
            <td style="font-size:0.85em">${b.email}</td>
            <td style="font-family:monospace;font-size:0.85em">${b.studentId}</td>
            <td>${getDepartmentName(b.department)}</td>
            <td><span class="ticket-badge ${b.ticketType}">${getTicketTypeName(b.ticketType)}</span></td>
            <td><strong>${(b.total||0).toLocaleString('fr-FR')} ${CONFIG.currency}</strong></td>
            <td style="font-size:0.85em">${formatDate(b.date)}</td>
            <td><span class="status-badge ${b.validated?'status-validated':'status-pending'}">
                ${b.validated ? '<i class="fas fa-check"></i> Validé' : '<i class="fas fa-clock"></i> En attente'}
            </span></td>
            <td>
                <div class="action-buttons">
                    <button onclick="viewDetails('${b.id}')" class="btn-action btn-view" title="Voir détails">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${!b.validated ? `<button onclick="validateTicket('${b.id}')" class="btn-action btn-validate" title="Valider">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    <button onclick="deleteBooking('${b.id}')" class="btn-action btn-delete" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>`;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.booking-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            this.checked ? state.selectedBookings.add(this.value) : state.selectedBookings.delete(this.value);
            document.getElementById('selectAll').checked = false;
        });
    });

    updatePagination();
}

// ============================================================
// FILTRES & TRI
// ============================================================
function applyFilters() {
    const tt  = document.getElementById('filterTicketType').value;
    const st  = document.getElementById('filterStatus').value;
    const dep = document.getElementById('filterDepartment').value;
    const yr  = document.getElementById('filterYear').value;
    const q   = document.getElementById('searchInput').value.toLowerCase().trim();

    state.filteredBookings = state.bookings.filter(b => {
        if (tt  !== 'all' && b.ticketType  !== tt)  return false;
        if (dep !== 'all' && b.department  !== dep) return false;
        if (yr  !== 'all' && b.year        !== yr)  return false;
        if (st  === 'validated' && !b.validated)    return false;
        if (st  === 'pending'   &&  b.validated)    return false;
        if (q && !(
            b.name.toLowerCase().includes(q) ||
            b.email.toLowerCase().includes(q) ||
            b.studentId.toLowerCase().includes(q)
        )) return false;
        return true;
    });

    sortBookings();
    state.currentPage = 1;
    displayBookings();
    updateStatistics();
    updateCharts();
}

function resetFilters() {
    ['filterTicketType','filterStatus','filterDepartment','filterYear'].forEach(id => {
        document.getElementById(id).value = 'all';
    });
    document.getElementById('searchInput').value = '';
    applyFilters();
}

function sortTable(col) {
    state.sortDirection = (state.sortColumn === col && state.sortDirection === 'asc') ? 'desc' : 'asc';
    state.sortColumn = col;
    sortBookings();
    displayBookings();
}

function sortBookings() {
    state.filteredBookings.sort((a, b) => {
        let va = a[state.sortColumn], vb = b[state.sortColumn];
        if (state.sortColumn === 'date')  { va = new Date(va); vb = new Date(vb); }
        if (state.sortColumn === 'total') { va = Number(va);   vb = Number(vb);   }
        if (va < vb) return state.sortDirection === 'asc' ? -1 : 1;
        if (va > vb) return state.sortDirection === 'asc' ?  1 : -1;
        return 0;
    });
}

function handleSearch() {
    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(applyFilters, 300);
}

// ============================================================
// PAGINATION
// ============================================================
function updatePagination() {
    const total = Math.ceil(state.filteredBookings.length / CONFIG.itemsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${state.currentPage} sur ${total || 1}`;
    document.getElementById('prevPage').disabled = state.currentPage === 1;
    document.getElementById('nextPage').disabled = state.currentPage >= total || total === 0;
}

function changePage(dir) {
    const total = Math.ceil(state.filteredBookings.length / CONFIG.itemsPerPage);
    if (dir === 'prev' && state.currentPage > 1) state.currentPage--;
    if (dir === 'next' && state.currentPage < total) state.currentPage++;
    displayBookings();
}

// ============================================================
// SÉLECTION
// ============================================================
function toggleSelectAll() {
    const all = document.getElementById('selectAll').checked;
    document.querySelectorAll('.booking-checkbox').forEach(cb => {
        cb.checked = all;
        all ? state.selectedBookings.add(cb.value) : state.selectedBookings.delete(cb.value);
    });
}

// ============================================================
// DÉTAILS
// ============================================================
function viewDetails(id) {
    const b = state.bookings.find(x => x.id === id);
    if (!b) return;

    document.getElementById('bookingDetails').innerHTML = `
        <div class="booking-detail-grid">
            <div class="detail-item"><div class="detail-label">Nom complet</div><div class="detail-value">${b.name}</div></div>
            <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${b.email}</div></div>
            <div class="detail-item"><div class="detail-label">Matricule</div><div class="detail-value">${b.studentId}</div></div>
            <div class="detail-item"><div class="detail-label">Téléphone</div><div class="detail-value">${b.phone||'Non renseigné'}</div></div>
            <div class="detail-item"><div class="detail-label">Filière</div><div class="detail-value">${getDepartmentName(b.department)}</div></div>
            <div class="detail-item"><div class="detail-label">Année</div><div class="detail-value">${getYearName(b.year)}</div></div>
            <div class="detail-item"><div class="detail-label">Type billet</div><div class="detail-value">${getTicketTypeName(b.ticketType)}</div></div>
            <div class="detail-item"><div class="detail-label">Montant</div><div class="detail-value">${(b.total||0).toLocaleString('fr-FR')} ${CONFIG.currency}</div></div>
            <div class="detail-item"><div class="detail-label">Date réservation</div><div class="detail-value">${formatDate(b.date)}</div></div>
            <div class="detail-item"><div class="detail-label">Statut paiement</div><div class="detail-value">
                <span class="status-badge ${b.validated?'status-validated':'status-pending'}">
                    ${b.validated?'✅ Validé':'⏳ En attente'}
                </span></div>
            </div>
            <div class="detail-item"><div class="detail-label">Options</div><div class="detail-value">
                ${b.tshirt?'✓ T-shirt ':''}${b.drink?'✓ Boisson':''}${!b.tshirt&&!b.drink?'Aucune':''}
            </div></div>
            <div class="detail-item" style="text-align:center">
                <div class="detail-label">QR Code</div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(b.id)}" alt="QR" style="border-radius:6px;margin-top:6px;">
            </div>
        </div>
        ${!b.validated ? `<button onclick="validateTicket('${b.id}');closeDetailsModal();" style="width:100%;padding:12px;background:#4CAF50;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:1em;margin-top:5px;">
            <i class="fas fa-check"></i> Valider ce billet
        </button>` : ''}`;

    document.getElementById('detailsModal').style.display = 'block';
}

// ============================================================
// VALIDATION & SUPPRESSION
// ============================================================
function validateTicket(id) {
    const b = state.bookings.find(x => x.id === id);
    if (!b) return;
    if (confirm(`Valider le billet de ${b.name} ?`)) {
        b.validated = true;
        localStorage.setItem('bookings', JSON.stringify(state.bookings));
        showNotification(`✅ Billet de ${b.name} validé !`, 'success');
        applyFilters();
    }
}

function deleteBooking(id) {
    const b = state.bookings.find(x => x.id === id);
    if (!b) return;
    if (confirm(`Supprimer la réservation de ${b.name} ?`)) {
        state.bookings = state.bookings.filter(x => x.id !== id);
        localStorage.setItem('bookings', JSON.stringify(state.bookings));
        showNotification('Réservation supprimée', 'success');
        applyFilters();
    }
}

// ============================================================
// EXPORTS
// ============================================================
function exportToExcel() {
    const data = state.filteredBookings.map(b => ({
        'Nom':         b.name,
        'Email':       b.email,
        'Matricule':   b.studentId,
        'Téléphone':   b.phone||'',
        'Filière':     getDepartmentName(b.department),
        'Année':       getYearName(b.year),
        'Billet':      getTicketTypeName(b.ticketType),
        'T-shirt':     b.tshirt?'Oui':'Non',
        'Boisson':     b.drink?'Oui':'Non',
        'Montant XAF': b.total||0,
        'Statut':      b.validated?'Validé':'En attente',
        'Date':        formatDate(b.date)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Réservations');
    XLSX.writeFile(wb, `reservations_IMSA_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('✅ Export Excel réussi', 'success');
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('Réservations — Journée d\'Intégration IMSA 2026', 14, 18);
    doc.setFontSize(10);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — ${state.filteredBookings.length} réservation(s)`, 14, 26);
    doc.autoTable({
        startY: 32,
        head: [['Nom','Email','Matricule','Filière','Billet','Montant','Statut','Date']],
        body: state.filteredBookings.map(b => [
            b.name, b.email, b.studentId,
            getDepartmentName(b.department), getTicketTypeName(b.ticketType),
            `${(b.total||0).toLocaleString('fr-FR')} XAF`,
            b.validated?'Validé':'En attente', formatDate(b.date)
        ]),
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [102, 126, 234] }
    });
    doc.save(`reservations_IMSA_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('✅ Export PDF réussi', 'success');
}

function printList() {
    let rows = state.filteredBookings.map(b => `
        <tr>
            <td>${b.name}</td><td>${b.email}</td><td>${b.studentId}</td>
            <td>${getDepartmentName(b.department)}</td><td>${getTicketTypeName(b.ticketType)}</td>
            <td>${(b.total||0).toLocaleString('fr-FR')} XAF</td>
            <td class="${b.validated?'v':'p'}">${b.validated?'Validé':'En attente'}</td>
        </tr>`).join('');

    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Réservations IMSA 2026</title>
    <style>body{font-family:Arial;padding:20px}h1{color:#333}
    table{width:100%;border-collapse:collapse;margin-top:15px}
    th{background:#667eea;color:white;padding:10px;text-align:left}
    td{padding:8px;border-bottom:1px solid #ddd;font-size:13px}
    .v{color:green;font-weight:bold}.p{color:orange;font-weight:bold}
    </style></head><body>
    <h1>Réservations — Journée d'Intégration IMSA 2026</h1>
    <p>Généré le ${new Date().toLocaleDateString('fr-FR')} — ${state.filteredBookings.length} réservation(s)</p>
    <table><thead><tr><th>Nom</th><th>Email</th><th>Matricule</th><th>Filière</th><th>Billet</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
    w.print();
}

// ============================================================
// SCANNER QR CODE
// ============================================================
function showScanModal() {
    document.getElementById('scanModal').style.display = 'block';
    document.getElementById('scanResult').innerHTML = '';

    const scanner = new Html5Qrcode('qr-reader');
    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        text => { handleScannedCode(text); scanner.stop(); },
        () => {}
    ).catch(() => {
        document.getElementById('scanResult').innerHTML =
            '<div class="scan-result error"><i class="fas fa-exclamation-circle"></i> Erreur d\'accès à la caméra</div>';
    });
    state.qrScanner = scanner;
}

function closeScanModal() {
    document.getElementById('scanModal').style.display = 'none';
    if (state.qrScanner) { try { state.qrScanner.stop(); } catch(e){} }
}

function handleScannedCode(code) {
    const b = state.bookings.find(x => x.id === code || x.id.includes(code));
    const div = document.getElementById('scanResult');
    if (!b) {
        div.innerHTML = '<div class="scan-result error"><i class="fas fa-times-circle"></i> Billet introuvable</div>';
    } else if (b.validated) {
        div.innerHTML = `<div class="scan-result error"><i class="fas fa-times-circle"></i> Billet déjà utilisé !<br><strong>${b.name}</strong></div>`;
    } else {
        div.innerHTML = `<div class="scan-result success"><i class="fas fa-check-circle"></i> Billet valide !<br>
            <strong>${b.name}</strong> — ${getDepartmentName(b.department)}<br>
            <button onclick="validateTicket('${b.id}')" style="margin-top:10px;padding:8px 16px;background:#4CAF50;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:700;">
                ✅ Valider l'entrée
            </button></div>`;
    }
}

function manualCheck() {
    const id = document.getElementById('manualTicketId').value.trim();
    if (id) handleScannedCode(id);
}

// ============================================================
// MODALS
// ============================================================
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

window.addEventListener('click', e => {
    if (e.target === document.getElementById('detailsModal')) closeDetailsModal();
    if (e.target === document.getElementById('scanModal')) closeScanModal();
});

// ============================================================
// REFRESH & TEMPS
// ============================================================
function refreshData() {
    loadBookings();
    updateLastUpdateTime();
    showNotification('Données actualisées', 'success');
}

function updateLastUpdateTime() {
    document.getElementById('updateTime').textContent = new Date().toLocaleTimeString('fr-FR');
}

// ============================================================
// ÉVÉNEMENTS
// ============================================================
function setupEventListeners() {
    ['filterTicketType','filterStatus','filterDepartment','filterYear'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
    document.getElementById('searchInput').addEventListener('keyup', handleSearch);
    document.getElementById('selectAll').addEventListener('change', toggleSelectAll);
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function showNotification(msg, type = 'info') {
    const colors = { success:'#4CAF50', error:'#f44336', warning:'#ff9800', info:'#2196f3' };
    const n = document.createElement('div');
    n.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'times-circle':'info-circle'}"></i><span>${msg}</span>`;
    n.style.cssText = `position:fixed;top:20px;right:20px;background:${colors[type]};color:white;
        padding:14px 20px;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.2);
        z-index:3000;display:flex;align-items:center;gap:10px;font-weight:600;
        animation:slideInRight 0.3s ease;max-width:320px;`;
    document.body.appendChild(n);
    setTimeout(() => { n.style.animation='slideOutRight 0.3s ease'; setTimeout(()=>n.remove(),300); }, 3500);
}

// ============================================================
// UTILITAIRES
// ============================================================
function formatDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function getDepartmentName(d) {
    return { info:'Informatique', gestion:'Gestion', marketing:'Marketing', rh:'Ressources Humaines', compta:'Comptabilité', autre:'Autre' }[d] || d;
}
function getTicketTypeName(t) {
    return { simple:'Simple', repas:'Avec repas', vip:'VIP' }[t] || t;
}
function getYearName(y) {
    return { '1':'Licence 1','2':'Licence 2','3':'Licence 3','4':'Master 1','5':'Master 2' }[y] || y;
}
