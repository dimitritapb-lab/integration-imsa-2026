// ============================================================
// CONFIGURATION PRINCIPALE
// ============================================================
const CONFIG = {
    eventDate: '2026-03-15T09:00:00',
    totalPlaces: 200,
    adminEmail: 'carbosadboy@gmail.com',
    // ⚠️  Mot de passe pour accéder à la page admin
    // Changez-le avant de déployer !
    adminPassword: 'imsa2026',

    emailjs: {
        publicKey:  'i-7EoiEYoD6Ib0yVB',  // ← Votre clé publique EmailJS
        serviceId:  'service_billet0',       // ← Votre Service ID EmailJS
        templateId: 'template_mx3pmjr'       // ← Votre Template ID EmailJS
    }
};

// ============================================================
// ÉTAT DE L'APPLICATION
// ============================================================
let state = {
    placesLeft: CONFIG.totalPlaces,
    bookings: JSON.parse(localStorage.getItem('bookings')) || []
};

// ============================================================
// INITIALISATION EMAILJS
// ============================================================
(function() {
    try {
        emailjs.init(CONFIG.emailjs.publicKey);
        console.log('✅ EmailJS initialisé');
    } catch(e) {
        console.warn('⚠️ EmailJS non disponible:', e);
    }
})();

// ============================================================
// ACCÈS ADMIN AVEC MOT DE PASSE
// ============================================================
function checkAdminAccess(event) {
    event.preventDefault();
    document.getElementById('adminModal').style.display = 'block';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminError').textContent = '';
    setTimeout(() => document.getElementById('adminPassword').focus(), 200);
}

function verifyAdmin() {
    const pwd = document.getElementById('adminPassword').value;
    if (pwd === CONFIG.adminPassword) {
        document.getElementById('adminModal').style.display = 'none';
        sessionStorage.setItem("adminAuth", "imsa2026ok");
        document.getElementById("adminModal").style.display = "none";
        window.location.href = "admin.html";
    } else {
        const err = document.getElementById('adminError');
        err.textContent = '❌ Mot de passe incorrect';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
        // Petite animation de secousse
        err.style.animation = 'none';
        err.offsetHeight; // reflow
        err.style.animation = 'shake 0.4s ease';
    }
}

// ============================================================
// COMPTE À REBOURS
// ============================================================
function updateCountdown() {
    const eventDate = new Date(CONFIG.eventDate).getTime();
    const now = new Date().getTime();
    const distance = eventDate - now;

    if (distance < 0) {
        document.getElementById('countdown').innerHTML = "<h3>L'événement a commencé !</h3>";
        return;
    }

    document.getElementById('days').textContent    = String(Math.floor(distance / 86400000)).padStart(2, '0');
    document.getElementById('hours').textContent   = String(Math.floor((distance % 86400000) / 3600000)).padStart(2, '0');
    document.getElementById('minutes').textContent = String(Math.floor((distance % 3600000) / 60000)).padStart(2, '0');
    document.getElementById('seconds').textContent = String(Math.floor((distance % 60000) / 1000)).padStart(2, '0');
}

// ============================================================
// CALCUL DU TOTAL
// ============================================================
function calculateTotal() {
    let total = 0;
    const selected = document.querySelector('input[name="ticketType"]:checked');
    if (selected) total += parseInt(selected.closest('.ticket-option').dataset.price);
    if (document.getElementById('tshirt').checked) total += 2000;
    if (document.getElementById('drink').checked)  total += 1000;
    document.getElementById('totalAmount').textContent = total.toLocaleString('fr-FR');
    return total;
}

// ============================================================
// UTILITAIRES
// ============================================================
function generateTicketId() {
    return 'IMSA-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function updatePlacesLeft() {
    state.placesLeft = CONFIG.totalPlaces - state.bookings.length;
    const el = document.getElementById('placesLeft');
    if (el) el.textContent = state.placesLeft;
    const bar = document.getElementById('availabilityProgress');
    if (bar) bar.style.width = (state.placesLeft / CONFIG.totalPlaces * 100) + '%';
    if (state.placesLeft <= 10 && state.placesLeft > 0) {
        showNotification(`⚠️ Plus que ${state.placesLeft} places disponibles !`, 'warning');
    }
}

function saveBooking(data) {
    state.bookings.push(data);
    localStorage.setItem('bookings', JSON.stringify(state.bookings));
    updatePlacesLeft();
}

function getDepartmentName(d) {
    return { info:'Informatique', gestion:'Gestion', marketing:'Marketing', rh:'Ressources Humaines', compta:'Comptabilité', autre:'Autre' }[d] || d;
}
function getTicketTypeName(t) {
    return { simple:'Simple', repas:'Avec repas', vip:'VIP' }[t] || t;
}
function getYearName(y) {
    return { '1':'Licence 1', '2':'Licence 2', '3':'Licence 3', '4':'Master 1', '5':'Master 2' }[y] || y;
}
function getOptionsText(b) {
    let opts = [];
    if (b.tshirt) opts.push("T-shirt (+2 000 XAF)");
    if (b.drink)  opts.push("Boisson (+1 000 XAF)");
    return opts.length ? opts.join(", ") : "Aucune option";
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function showNotification(message, type = 'info') {
    const colors = { warning:'#ff9800', success:'#4CAF50', error:'#f44336', info:'#2196f3' };
    const icons  = { warning:'fa-exclamation-circle', success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle' };
    const n = document.createElement('div');
    n.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    n.style.cssText = `position:fixed;top:20px;right:20px;background:${colors[type]};color:white;
        padding:15px 20px;border-radius:8px;box-shadow:0 3px 10px rgba(0,0,0,0.2);
        z-index:4000;display:flex;align-items:center;gap:10px;max-width:350px;
        animation:slideInRight 0.3s ease;`;
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity='0'; n.style.transition='opacity 0.3s'; setTimeout(() => n.remove(), 300); }, 4000);
}

// ============================================================
// ENVOI EMAIL VIA EMAILJS
// ============================================================
async function sendEmailConfirmation(booking) {
    const params = {
        to_name:      booking.name,
        to_email:     booking.email,
        student_id:   booking.studentId,
        department:   getDepartmentName(booking.department),
        year:         getYearName(booking.year),
        ticket_type:  getTicketTypeName(booking.ticketType),
        options:      getOptionsText(booking),
        total:        booking.total.toLocaleString('fr-FR') + ' XAF',
        ticket_id:    booking.id,
        event_date:   '15 Mars 2026',
        phone:        booking.phone || 'Non renseigné',
        date:         new Date().toLocaleString('fr-FR')
    };

    try {
        // Email à l'étudiant
        await emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, params);
        // Email à l'admin
        await emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId,
            { ...params, to_email: CONFIG.adminEmail, to_name: 'Admin IMSA' });
        console.log('✅ Emails envoyés');
        return true;
    } catch (err) {
        console.error('❌ Erreur email:', err);
        return false;
    }
}

// ============================================================
// AFFICHER LE TICKET
// ============================================================
function displayTicket(booking) {
    document.getElementById('ticketInfo').innerHTML = `
        <p><strong>👤 ${booking.name}</strong></p>
        <p>📧 ${booking.email}</p>
        <p>🎓 ${getDepartmentName(booking.department)} - ${getYearName(booking.year)}</p>
        <p>🎫 ${getTicketTypeName(booking.ticketType)}</p>
        <p>💰 À payer : <strong>${booking.total.toLocaleString('fr-FR')} XAF</strong></p>
        <p>🔖 Réf : ${booking.id}</p>
    `;
    document.getElementById('qrCode').innerHTML =
        `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(booking.id)}" alt="QR Code" style="border-radius:8px;">`;
    document.getElementById('confirmationModal').style.display = 'block';
}

// ============================================================
// INITIALISATION AU CHARGEMENT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {

    updateCountdown();
    setInterval(updateCountdown, 1000);
    updatePlacesLeft();

    document.querySelectorAll('input[name="ticketType"], #tshirt, #drink').forEach(el => {
        el.addEventListener('change', calculateTotal);
    });

    // === SOUMISSION DU FORMULAIRE ===
    document.getElementById('ticketForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (state.placesLeft <= 0) {
            showNotification('Désolé, plus de places disponibles !', 'error');
            return;
        }

        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

        const booking = {
            id:         generateTicketId(),
            name:       document.getElementById('name').value.trim(),
            email:      document.getElementById('email').value.trim(),
            studentId:  document.getElementById('studentId').value.trim(),
            phone:      document.getElementById('phone').value.trim(),
            department: document.getElementById('department').value,
            year:       document.getElementById('year').value,
            ticketType: document.querySelector('input[name="ticketType"]:checked').value,
            tshirt:     document.getElementById('tshirt').checked,
            drink:      document.getElementById('drink').checked,
            total:      calculateTotal(),
            date:       new Date().toISOString(),
            validated:  false
        };

        // Sauvegarder
        saveBooking(booking);

        // Afficher le ticket
        displayTicket(booking);

        // Envoyer l'email
        const emailOk = await sendEmailConfirmation(booking);
        if (emailOk) {
            showNotification('✅ Email de confirmation envoyé !', 'success');
        } else {
            showNotification('⚠️ Réservation enregistrée. Vérifiez votre configuration EmailJS.', 'warning');
        }

        // Réinitialiser
        this.reset();
        calculateTotal();
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Réserver mon billet';
    });

    // Fermer modal confirmation
    document.querySelector('#confirmationModal .close').addEventListener('click', function() {
        document.getElementById('confirmationModal').style.display = 'none';
    });
    window.addEventListener('click', function(e) {
        if (e.target === document.getElementById('confirmationModal'))
            document.getElementById('confirmationModal').style.display = 'none';
        if (e.target === document.getElementById('adminModal'))
            document.getElementById('adminModal').style.display = 'none';
    });
});

// Barre de progression scroll
window.addEventListener('scroll', () => {
    const scrolled = (document.documentElement.scrollTop /
        (document.documentElement.scrollHeight - document.documentElement.clientHeight)) * 100;
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = scrolled + '%';
});
