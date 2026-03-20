
// ==========================================
// CONFIGURATION - UPDATE THIS!
// ==========================================
//const API_URL = 'https://script.google.com/macros/s/AKfycbxNumpoV-xMhvWWmZ_iEh5zc2j0NMmXWlIyXynx3waViE5Re_FVF2ejbEbmEYUGP7k/exec';
// Get this URL after deploying your Apps Script as a web app
// Example: https://script.google.com/macros/s/AKfycbxxx.../exec
const supabaseClient = window.supabase.createClient(
            "https://prbussyddjdlxtvoeerd.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYnVzc3lkZGpkbHh0dm9lZXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njg4OTAsImV4cCI6MjA4OTM0NDg5MH0.y5Ie0TcLZCfz9-3Sz0eb1LOKHfM301fuzt2MtJW9Ra0"
);
// ==========================================
// DATA & STATE
// ==========================================
let classes = [];
let lectures = [];
let currentMonth = new Date();

// ==========================================
// INITIALIZATION
// ==========================================


async function loadData() {
    const { data: classData } = await supabaseClient.from('classes').select('*');
    const { data: lectureData } = await supabaseClient.from('lectures').select('*');

    // Normalize classes FIRST (fix: was mapping before assignment)
    classes = (classData || []).map(c => ({
        ...c,
        hourlyRate: c.hourly_rate,
        totalHours: 0,
        totalEarnings: 0,
        lectureCount: 0
    }));

    // Normalize lectures
    lectures = (lectureData || []).map(l => ({
        ...l,
        className: l.class_name,
        classId: l.class_id
    }));

    // Recalculate totals safely
    lectures.forEach(l => {
        const cls = classes.find(c => c.id === l.classId);
        if (cls) {
            cls.totalHours += l.duration || 0;
            cls.totalEarnings += l.earnings || 0;
            cls.lectureCount += 1;
        }
    });
}



//save class
async function saveClassToDB(classData) {
const { data, error } = await supabaseClient
        .from('classes')
        .insert([{
        name: classData.name,
        hourly_rate: classData.hourlyRate
}])
.select();

if (error) throw error;
return data[0];
}

//save lectures
async function saveLectureToDB(lectureData) {
const { data, error } = await supabaseClient
.from('lectures')
.insert([{
    class_id: lectureData.classId,
    class_name: lectureData.className,
    date: lectureData.date,
    duration: lectureData.duration,
    topic: lectureData.topic,
    earnings: lectureData.earnings,
    hourly_rate: lectureData.hourlyRate,
    paid: lectureData.paid
}])
.select();

if (error) throw error;
return data[0];
}

//update payment
async function updatePayment(id, paid) {
const { error } = await supabaseClient
.from('lectures')
.update({ paid: paid })
.eq('id', id);

if (error) throw error;
}

//delete
async function deleteLectureFromDB(id) {
await supabaseClient.from('lectures').delete().eq('id', id);
}

async function deleteClassFromDB(id) {
await supabaseClient.from('classes').delete().eq('id', id);
}



// ==========================================
// LOCAL STORAGE (Backup/Fallback)
// ==========================================
function loadDataFromLocal() {
    const savedClasses = localStorage.getItem('teacherClasses');
    const savedLectures = localStorage.getItem('teacherLectures');
    
    if (savedClasses) classes = JSON.parse(savedClasses);
    if (savedLectures) lectures = JSON.parse(savedLectures);
}

function saveDataToLocal() {
    localStorage.setItem('teacherClasses', JSON.stringify(classes));
    localStorage.setItem('teacherLectures', JSON.stringify(lectures));
}

// ==========================================
// UI HELPERS
// ==========================================
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    updateMonthDisplay();
    updateStats();
    renderDashboard();
    renderLectures();
    renderPayments();
}

function goToCurrentMonth() {
    currentMonth = new Date();
    updateMonthDisplay();
    updateStats();
    renderDashboard();
    renderLectures();
    renderPayments();
}

function updateMonthDisplay() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = 
        `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
}

function isInCurrentMonth(dateString) {
    const date = new Date(dateString);
    return date.getMonth() === currentMonth.getMonth() && 
            date.getFullYear() === currentMonth.getFullYear();
}

// ==========================================
// FORM HANDLERS
// ==========================================
document.getElementById('classForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    
    try {
        const className = document.getElementById('className').value;
        const hourlyRate = parseFloat(document.getElementById('hourlyRate').value);
        
        const savedClass = await saveClassToDB({
            name: className,
            hourlyRate: hourlyRate
        });
        
        // Add to local array
        classes.push({
            id: savedClass.id,
            name: savedClass.name,
            hourlyRate: savedClass.hourly_rate,
            totalHours: 0,
            totalEarnings: 0,
            lectureCount: 0
        });
        
        saveDataToLocal();
        document.getElementById('classForm').reset();
        renderClasses();
        updateClassDropdown();
        
        hideLoading();
        alert('✅ Class added successfully!');
    } catch (error) {
        hideLoading();
        alert('❌ Error: ' + error.message);
    }
});

document.getElementById('lectureForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    
    try {
        const classId = parseInt(document.getElementById('lectureClass').value);
        const date = document.getElementById('lectureDate').value;
        const duration = parseFloat(document.getElementById('lectureDuration').value);
        const topic = document.getElementById('lectureTopic').value;
        const paid = document.getElementById('lecturePaid').checked;
        
        const selectedClass = classes.find(c => c.id === classId);
        const earnings = duration * selectedClass.hourlyRate;
        
        const savedLecture = await saveLectureToDB({
            classId: classId,
            className: selectedClass.name,
            date: date,
            duration: duration,
            topic: topic,
            earnings: earnings,
            hourlyRate: selectedClass.hourlyRate,
            paid: paid
        });
        
        // Add to local array
        lectures.push({
        ...savedLecture,
            className: savedLecture.class_name,  // 🔥 fix
            classId: savedLecture.class_id
        });;
        
        // Update class totals
        selectedClass.totalHours += duration;
        selectedClass.totalEarnings += earnings;
        selectedClass.lectureCount += 1;
        
        saveDataToLocal();
        
        document.getElementById('lectureDuration').value = '';
        document.getElementById('lectureTopic').value = '';
        document.getElementById('lecturePaid').checked = false;
        
        updateStats();
        renderDashboard();
        renderClasses();
        renderLectures();
        renderPayments();
        
        hideLoading();
        alert('✅ Lecture logged successfully!');
    } catch (error) {
        hideLoading();
        alert('❌ Error: ' + error.message);
    }
});

// ==========================================
// STATISTICS
// ==========================================
function updateStats() {
    const monthLectures = lectures.filter(l => isInCurrentMonth(l.date));
    
    const monthlyEarnings = monthLectures.reduce((sum, l) => sum + l.earnings, 0);
    const paidEarnings = monthLectures.filter(l => l.paid).reduce((sum, l) => sum + l.earnings, 0);
    const pendingEarnings = monthlyEarnings - paidEarnings;
    const monthlyHours = monthLectures.reduce((sum, l) => sum + l.duration, 0);
    
    document.getElementById('monthlyEarnings').textContent = '₹' + monthlyEarnings.toLocaleString('en-IN');
    document.getElementById('paidAmount').textContent = '₹' + paidEarnings.toLocaleString('en-IN');
    document.getElementById('pendingAmount').textContent = '₹' + pendingEarnings.toLocaleString('en-IN');
    document.getElementById('monthlyHours').textContent = monthlyHours.toFixed(1);
    
    const lectureCount = monthLectures.length;
    document.getElementById('earningsTrend').textContent = `${lectureCount} lectures`;
}

function renderDashboard() {
    const monthLectures = lectures.filter(l => isInCurrentMonth(l.date));
    
    // Overview stats
    const totalLectures = monthLectures.length;
    const totalHours = monthLectures.reduce((sum, l) => sum + l.duration, 0);
    const avgHours = totalLectures > 0 ? totalHours / totalLectures : 0;
    
    document.getElementById('dashLectures').textContent = totalLectures;
    document.getElementById('dashHours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('dashAvg').textContent = avgHours.toFixed(1) + 'h';
    
    // Payment progress
    const totalEarnings = monthLectures.reduce((sum, l) => sum + l.earnings, 0);
    const paidEarnings = monthLectures.filter(l => l.paid).reduce((sum, l) => sum + l.earnings, 0);
    const paymentPercent = totalEarnings > 0 ? (paidEarnings / totalEarnings * 100) : 0;
    
    const progressFill = document.getElementById('paymentProgress');
    progressFill.style.width = paymentPercent + '%';
    progressFill.textContent = paymentPercent >= 20 ? Math.round(paymentPercent) + '%' : '';
    
    document.getElementById('paymentPercent').textContent = Math.round(paymentPercent) + '% Paid';
    document.getElementById('paymentRatio').textContent = 
        `₹${paidEarnings.toLocaleString('en-IN')} / ₹${totalEarnings.toLocaleString('en-IN')}`;
    
    // Earnings by class
    const classTotals = {};
    let maxEarnings = 0;
    
    monthLectures.forEach(l => {
        if (!classTotals[l.className]) {
            classTotals[l.className] = { earnings: 0, hours: 0, count: 0 };
        }
        classTotals[l.className].earnings += l.earnings;
        classTotals[l.className].hours += l.duration;
        classTotals[l.className].count += 1;
        maxEarnings = Math.max(maxEarnings, classTotals[l.className].earnings);
    });
    
    const classBreakdown = document.getElementById('classBreakdown');
    if (Object.keys(classTotals).length === 0) {
        classBreakdown.innerHTML = '<div class="empty-state" style="padding: 20px;">No data for this month</div>';
    } else {
        const sortedClasses = Object.entries(classTotals)
            .sort((a, b) => b[1].earnings - a[1].earnings);
        
        classBreakdown.innerHTML = sortedClasses.map(([name, data]) => `
            <div class="class-breakdown-item">
                <div class="class-breakdown-name">${name}</div>
                <div class="class-breakdown-bar">
                    <div class="class-breakdown-fill" style="width: ${(data.earnings / maxEarnings * 100)}%"></div>
                </div>
                <div class="class-breakdown-value">₹${data.earnings.toLocaleString('en-IN')}</div>
            </div>
        `).join('');
    }
    
    // Recent activity
    const recentActivity = document.getElementById('recentActivity');
    if (monthLectures.length === 0) {
        recentActivity.innerHTML = '<div class="empty-state" style="padding: 20px;">No recent activity</div>';
    } else {
        const recent = [...monthLectures]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        
        recentActivity.innerHTML = recent.map(l => `
            <div class="activity-item">
                <div class="activity-icon">${l.paid ? '✓' : '⏱'}</div>
                <div class="activity-details">
                    <div class="activity-title">${l.className}</div>
                    <div class="activity-meta">
                        ${new Date(l.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})} 
                        • ${l.duration}h
                        ${l.topic ? '• ' + l.topic : ''}
                    </div>
                </div>
                <div class="activity-amount">₹${l.earnings.toLocaleString('en-IN')}</div>
            </div>
        `).join('');
    }
    
    // Top earning class
    const topClass = document.getElementById('topClass');
    if (Object.keys(classTotals).length === 0) {
        topClass.innerHTML = '<div class="highlight-icon">🏆</div><div class="highlight-text">No data yet</div>';
    } else {
        const top = Object.entries(classTotals).sort((a, b) => b[1].earnings - a[1].earnings)[0];
        topClass.innerHTML = `
            <div class="highlight-icon">🏆</div>
            <div class="highlight-text">${top[0]}</div>
            <div class="highlight-subtext">₹${top[1].earnings.toLocaleString('en-IN')} • ${top[1].count} lectures</div>
        `;
    }
    
    // Most frequent class
    const mostFrequent = document.getElementById('mostFrequent');
    if (Object.keys(classTotals).length === 0) {
        mostFrequent.innerHTML = '<div class="highlight-icon">📚</div><div class="highlight-text">No data yet</div>';
    } else {
        const frequent = Object.entries(classTotals).sort((a, b) => b[1].count - a[1].count)[0];
        mostFrequent.innerHTML = `
            <div class="highlight-icon">📚</div>
            <div class="highlight-text">${frequent[0]}</div>
            <div class="highlight-subtext">${frequent[1].count} lectures • ${frequent[1].hours.toFixed(1)}h</div>
        `;
    }
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderClasses() {
    const classList = document.getElementById('classList');
    
    if (classes.length === 0) {
        classList.innerHTML = '<div class="empty-state">No classes yet. Add your first class!</div>';
        return;
    }
    
    classList.innerHTML = classes.map(c => `
        <div class="class-item">
            <div class="class-info">
                <h3>${c.name}</h3>
                <div class="class-details">
                    ${c.lectureCount} lectures • ${c.totalHours.toFixed(1)}h • ₹${c.hourlyRate}/hr
                    <br>
                    Total: ₹${c.totalEarnings.toLocaleString('en-IN')}
                </div>
            </div>
            <button class="delete-btn" onclick="deleteClass(${c.id})">Delete</button>
        </div>
    `).join('');
}

function renderLectures() {
    const tbody = document.getElementById('lectureTableBody');
    const monthLectures = lectures.filter(l => isInCurrentMonth(l.date));
    
    if (monthLectures.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No lectures this month</td></tr>';
        return;
    }
    
    const sortedLectures = [...monthLectures].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sortedLectures.map(l => `
        <tr>
            <td>${new Date(l.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</td>
            <td><span class="badge">${l.className}</span></td>
            <td>${l.topic || '—'}</td>
            <td>${l.duration}h</td>
            <td>₹${l.earnings.toLocaleString('en-IN')}</td>
            <td>
                <span class="payment-badge ${l.paid ? 'paid' : 'unpaid'}">
                    ${l.paid ? '✓ Paid' : '⏱ Pending'}
                </span>
            </td>
            <td>
                <button class="mini-btn" onclick="togglePayment(${l.id})">${l.paid ? 'Unpay' : 'Mark Paid'}</button>
                <button class="delete-btn" onclick="deleteLecture(${l.id})" style="margin-left: 5px;">×</button>
            </td>
        </tr>
    `).join('');
}

function renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    const monthLectures = lectures.filter(l => isInCurrentMonth(l.date));
    
    if (monthLectures.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No payment records this month</td></tr>';
        return;
    }
    
    const sortedLectures = [...monthLectures].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sortedLectures.map(l => `
        <tr>
            <td>${new Date(l.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</td>
            <td><span class="badge">${l.className}</span></td>
            <td>₹${l.earnings.toLocaleString('en-IN')}</td>
            <td>
                <span class="payment-badge ${l.paid ? 'paid' : 'unpaid'}">
                    ${l.paid ? '✓ Paid' : '⏱ Pending'}
                </span>
            </td>
            <td>
                <button class="mini-btn" onclick="togglePayment(${l.id})">${l.paid ? 'Unpay' : 'Mark Paid'}</button>
            </td>
        </tr>
    `).join('');
}

function updateClassDropdown() {
    const select = document.getElementById('lectureClass');
    select.innerHTML = '<option value="">Choose a class</option>' + 
        classes.map(c => `<option value="${c.id}">${c.name} (₹${c.hourlyRate}/hr)</option>`).join('');
}

// ==========================================
// ACTION HANDLERS
// ==========================================
async function togglePayment(id) {
    showLoading();
    
    try {
        const lecture = lectures.find(l => l.id === id);
        const newPaidStatus = !lecture.paid;
        
        await updatePayment(id, newPaidStatus);;
        
        lecture.paid = newPaidStatus;
        saveDataToLocal();
        
        updateStats();
        renderDashboard();
        renderLectures();
        renderPayments();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        alert('❌ Error: ' + error.message);
    }
}

async function deleteClass(id) {
    if (!confirm('Delete this class and all its lectures?')) return;
    
    showLoading();
    
    try {
        await deleteClassFromDB(id);
        
        classes = classes.filter(c => c.id !== id);
        lectures = lectures.filter(l => l.classId !== id);
        
        saveDataToLocal();
        updateStats();
        renderDashboard();
        renderClasses();
        renderLectures();
        renderPayments();
        updateClassDropdown();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        alert('❌ Error: ' + error.message);
    }
}

async function deleteLecture(id) {
    if (!confirm('Delete this lecture?')) return;
    
    showLoading();
    
    try {
        await deleteLectureFromDB(id);
        
        const lecture = lectures.find(l => l.id === id);
        const classObj = classes.find(c => c.id === lecture.classId);
        
        if (classObj) {
            classObj.totalHours -= lecture.duration;
            classObj.totalEarnings -= lecture.earnings;
            classObj.lectureCount -= 1;
        }
        
        lectures = lectures.filter(l => l.id !== id);
        
        saveDataToLocal();
        updateStats();
        renderDashboard();
        renderClasses();
        renderLectures();
        renderPayments();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        alert('❌ Error: ' + error.message);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
}

        // Initialize app
        async function init() {
    showLoading();

    try {
        await loadData();
    } catch (e) {
        console.error(e);
        loadDataFromLocal();
    }

    updateMonthDisplay();
    updateStats();
    renderDashboard();
    renderClasses();
    renderLectures();
    renderPayments();
    updateClassDropdown();

    document.getElementById('lectureDate').valueAsDate = new Date();

    hideLoading();
}
init();
