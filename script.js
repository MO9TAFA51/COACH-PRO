import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection, 
    getDocs,
    updateDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBeUimi5NKwV2LOgi47-LhNFKYju2WVKUU",
    authDomain: "gym-system-41.firebaseapp.com",
    projectId: "gym-system-41",
    storageBucket: "gym-system-41.firebasestorage.app",
    messagingSenderId: "560220070298",
    appId: "1:560220070298:web:11cd039ba57b66b20b9a23"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let unsubscribeClients = null;
let currentClientId = null;
let currentClientData = null;
let currentPlanType = null;
let selectedWorkoutDays = 0;
let workoutData = {};

async function loadClients() {
    console.log("🔄 جاري تحميل قائمة المتدربين...");
    const tableBody = document.getElementById('clientTableBody');
    if (!tableBody) return;
    
    try {
        const querySnapshot = await getDocs(collection(db, "plans"));
        tableBody.innerHTML = "";
        let count = 0;
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            
            if (data.isAdmin || data.role === "admin" || data.email === "admin@gym.com") {
                return;
            }
            
            count++;
            
            const status = data.isActive !== false ? 'نشط' : 'غير نشط';
            const statusClass = data.isActive !== false ? 'active' : 'inactive';
            
            const isNew = isRecentlyCreated(data.createdAt);
            const newBadge = isNew ? '<span class="new-badge">🆕 جديد</span>' : '';
            
            tableBody.innerHTML += `
                <tr>
                    <td>
                        <strong>${data.name || docId}</strong>
                        ${newBadge}
                        <br>
                        <small style="color:#666;">
                            <i class="fas fa-envelope"></i> ${data.email || "لا يوجد إيميل"}
                        </small>
                    </td>
                    <td>${data.goal || 'هدف عام'}</td>
                    <td><span class="status ${statusClass}">${status}</span></td>
                    <td>
                        <button onclick="openPlanModal('${docId}')" class="btn-action">
                            <i class="fas fa-edit"></i> تعديل النظام
                        </button>
                        <button onclick="showClientInfo('${docId}')" class="btn-info">
                            <i class="fas fa-info-circle"></i> معلومات
                        </button>
                        <button onclick="toggleClientStatus('${docId}', ${data.isActive !== false})" 
                                class="btn-status ${data.isActive !== false ? 'deactivate' : 'activate'}">
                            <i class="fas ${data.isActive !== false ? 'fa-pause' : 'fa-play'}"></i> 
                            ${data.isActive !== false ? 'إيقاف' : 'تفعيل'}
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = tableBody.innerHTML || 
            '<tr><td colspan="4" style="text-align:center; padding:40px; color:#666;"><i class="fas fa-users" style="font-size:40px; display:block; margin-bottom:10px;"></i>لا يوجد متدربين مسجلين بعد</td></tr>';
        
        document.getElementById('clientCount').innerText = count;
        
    } catch (error) {
        console.error("❌ خطأ في تحميل المتدربين:", error);
        tableBody.innerHTML = '<tr><td colspan="4">⚠️ خطأ في تحميل البيانات</td></tr>';
        showNotification("❌ حدث خطأ في تحميل المتدربين", "error");
    }
}

function isRecentlyCreated(createdAt) {
    if (!createdAt) return false;
    
    try {
        const arabicToEnglish = {
            '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5',
            '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٠': '0',
            'ص': 'AM', 'م': 'PM'
        };
        
        let englishDate = createdAt;
        for (const [arabic, english] of Object.entries(arabicToEnglish)) {
            englishDate = englishDate.replace(new RegExp(arabic, 'g'), english);
        }
        
        const createdDate = new Date(englishDate);
        const now = new Date();
        const diffHours = (now - createdDate) / (1000 * 60 * 60);
        
        return diffHours < 24;
    } catch (e) {
        return false;
    }
}

window.toggleClientStatus = async function(clientId, isCurrentlyActive) {
    const newStatus = !isCurrentlyActive;
    const action = newStatus ? 'تفعيل' : 'إيقاف';
    
    if (!confirm(`هل تريد ${action} هذا المتدرب؟`)) return;
    
    try {
        await updateDoc(doc(db, "plans", clientId), {
            isActive: newStatus,
            lastUpdated: new Date().toLocaleString('ar-SA')
        });
        
        showNotification(`✅ تم ${action} المتدرب بنجاح`, "success");
        loadClients();
        
    } catch (error) {
        console.error("❌ خطأ في تغيير الحالة:", error);
        showNotification("❌ حدث خطأ في تغيير الحالة", "error");
    }
};

function showNotification(message, type = 'info', duration = 4000) {
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) oldNotification.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    
    notification.innerHTML = `
        <span style="font-size: 20px;">${icon}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" 
                style="background:none; border:none; color:#666; cursor:pointer; margin-right:auto;">
            ✕
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
    
    return notification;
}

// === الوظائف الجديدة ===

window.openPlanModal = async function(clientId) {
    console.log("✏️ فتح تعديل نظام:", clientId);
    
    currentClientId = clientId;
    currentPlanType = null;
    selectedWorkoutDays = 0;
    workoutData = {};
    
    document.getElementById('clientNameDisplay').textContent = clientId;
    document.getElementById('planModal').style.display = 'block';
    
    // إخفاء جميع الخطوات وإظهار الخطوة الأولى
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2-diet').style.display = 'none';
    document.getElementById('step2-workout').style.display = 'none';
    document.getElementById('step3-workout-table').style.display = 'none';
    
    try {
        const docSnap = await getDoc(doc(db, "plans", clientId));
        
        if (docSnap.exists()) {
            currentClientData = docSnap.data();
            
            // تحميل بيانات النظام الغذائي إذا كانت موجودة
            if (currentClientData.dietData) {
                try {
                    const dietData = JSON.parse(currentClientData.dietData);
                    for (let i = 1; i <= 6; i++) {
                        const mealInput = document.getElementById(`meal${i}`);
                        if (mealInput && dietData[`meal${i}`]) {
                            mealInput.value = dietData[`meal${i}`];
                        }
                    }
                } catch (e) {
                    console.error("خطأ في تحميل بيانات النظام الغذائي:", e);
                }
            }
            
            // تحميل بيانات التمارين إذا كانت موجودة
            if (currentClientData.workoutTableData) {
                try {
                    workoutData = JSON.parse(currentClientData.workoutTableData);
                } catch (e) {
                    console.error("خطأ في تحميل بيانات التمارين:", e);
                }
            }
            
        } else {
            showNotification("❌ المشترك غير موجود!", "error");
            closeModal();
        }
    } catch (error) {
        console.error("❌ خطأ في تحميل البيانات:", error);
        showNotification("حدث خطأ في تحميل البيانات", "error");
    }
};

window.selectPlanType = function(type) {
    currentPlanType = type;
    
    document.getElementById('step1').style.display = 'none';
    
    if (type === 'diet') {
        document.getElementById('step2-diet').style.display = 'block';
    } else if (type === 'workout') {
        document.getElementById('step2-workout').style.display = 'block';
    }
};

window.backToStep1 = function() {
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2-diet').style.display = 'none';
    document.getElementById('step2-workout').style.display = 'none';
    document.getElementById('step3-workout-table').style.display = 'none';
    currentPlanType = null;
};

window.selectWorkoutDays = function(days) {
    selectedWorkoutDays = days;
    
    document.getElementById('step2-workout').style.display = 'none';
    document.getElementById('step3-workout-table').style.display = 'block';
    document.getElementById('selectedDaysCount').textContent = days;
    
    // إنشاء جدول التمارين
    createWorkoutTable(days);
};

window.backToWorkoutDays = function() {
    document.getElementById('step2-workout').style.display = 'block';
    document.getElementById('step3-workout-table').style.display = 'none';
};

function createWorkoutTable(days) {
    const container = document.getElementById('workoutTableContainer');
    container.innerHTML = '';
    
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    // إذا كانت هناك بيانات محفوظة مسبقاً، استخدمها
    if (!workoutData.days || workoutData.days !== days) {
        workoutData = {
            days: days,
            schedule: {}
        };
        
        // إنشاء جدول فارغ لكل يوم
        for (let i = 0; i < days; i++) {
            workoutData.schedule[`day${i+1}`] = {
                dayName: dayNames[i],
                exercises: [
                    { name: '', link: '', sets: '', reps: '', rest: '' }
                ]
            };
        }
    }
    
    // إنشاء الجداول لكل يوم
    for (let i = 0; i < days; i++) {
        const dayKey = `day${i+1}`;
        const dayData = workoutData.schedule[dayKey];
        
        const daySection = document.createElement('div');
        daySection.className = 'day-section';
        daySection.id = `day-section-${i+1}`;
        
        daySection.innerHTML = `
            <div class="day-header">
                <i class="fas fa-calendar-day"></i>
                اليوم ${i+1} - ${dayData.dayName}
            </div>
            
            <table class="workout-table" id="workout-table-${i+1}">
                <thead>
                    <tr>
                        <th style="width: 25%;">اسم التمرين</th>
                        <th style="width: 25%;">رابط الفيديو</th>
                        <th style="width: 15%;">المجموعات</th>
                        <th style="width: 15%;">التكرارات</th>
                        <th style="width: 20%;">وقت الراحة (ثانية)</th>
                    </tr>
                </thead>
                <tbody id="workout-tbody-${i+1}">
                </tbody>
            </table>
            
            <button onclick="addExerciseRow(${i+1})" class="add-exercise-btn">
                <i class="fas fa-plus"></i> إضافة تمرين
            </button>
        `;
        
        container.appendChild(daySection);
        
        // إضافة الصفوف الموجودة
        const tbody = document.getElementById(`workout-tbody-${i+1}`);
        dayData.exercises.forEach((exercise, index) => {
            addExerciseRowToTable(i+1, index, exercise);
        });
    }
}

function addExerciseRowToTable(dayNum, exerciseIndex, exerciseData = {}) {
    const tbody = document.getElementById(`workout-tbody-${dayNum}`);
    const row = tbody.insertRow();
    
    row.innerHTML = `
        <td>
            <input type="text" 
                   placeholder="مثال: بنش برس" 
                   value="${exerciseData.name || ''}"
                   onchange="updateWorkoutData(${dayNum}, ${exerciseIndex}, 'name', this.value)">
        </td>
        <td>
            <input type="text" 
                   placeholder="https://youtube.com/..." 
                   value="${exerciseData.link || ''}"
                   onchange="updateWorkoutData(${dayNum}, ${exerciseIndex}, 'link', this.value)">
        </td>
        <td>
            <input type="number" 
                   placeholder="4" 
                   min="1" 
                   value="${exerciseData.sets || ''}"
                   onchange="updateWorkoutData(${dayNum}, ${exerciseIndex}, 'sets', this.value)">
        </td>
        <td>
            <input type="number" 
                   placeholder="12" 
                   min="1" 
                   value="${exerciseData.reps || ''}"
                   onchange="updateWorkoutData(${dayNum}, ${exerciseIndex}, 'reps', this.value)">
        </td>
        <td>
            <input type="number" 
                   placeholder="60" 
                   min="0" 
                   value="${exerciseData.rest || ''}"
                   onchange="updateWorkoutData(${dayNum}, ${exerciseIndex}, 'rest', this.value)">
        </td>
    `;
}

window.addExerciseRow = function(dayNum) {
    const dayKey = `day${dayNum}`;
    const exerciseIndex = workoutData.schedule[dayKey].exercises.length;
    
    workoutData.schedule[dayKey].exercises.push({
        name: '',
        link: '',
        sets: '',
        reps: '',
        rest: ''
    });
    
    addExerciseRowToTable(dayNum, exerciseIndex);
};

window.updateWorkoutData = function(dayNum, exerciseIndex, field, value) {
    const dayKey = `day${dayNum}`;
    workoutData.schedule[dayKey].exercises[exerciseIndex][field] = value;
};

window.saveDietPlan = async function() {
    if (!currentClientId) {
        showNotification("❌ لم يتم تحديد متدرب", "error");
        return;
    }
    
    const dietData = {};
    const dietText = [];
    
    for (let i = 1; i <= 6; i++) {
        const mealInput = document.getElementById(`meal${i}`);
        if (mealInput && mealInput.value.trim()) {
            dietData[`meal${i}`] = mealInput.value.trim();
            
            const mealNames = [
                'الوجبة الأولى',
                'الوجبة الثانية', 
                'الوجبة الثالثة',
                'الوجبة الرابعة',
                'الوجبة الخامسة',
                'وجبة إضافية'
            ];
            
            dietText.push(`${mealNames[i-1]}:\n${mealInput.value.trim()}`);
        }
    }
    
    if (dietText.length === 0) {
        showNotification("⚠️ يرجى إضافة وجبة واحدة على الأقل", "error");
        return;
    }
    
    try {
        const dietString = dietText.join('\n\n');
        
        await updateDoc(doc(db, "plans", currentClientId), {
            diet: dietString,
            dietData: JSON.stringify(dietData),
            lastUpdated: new Date().toLocaleString('ar-SA')
        });
        
        showNotification(`✅ تم حفظ النظام الغذائي للمتدرب "${currentClientId}"`, "success");
        closeModal();
        loadClients();
        
    } catch (error) {
        console.error("❌ خطأ في الحفظ:", error);
        showNotification("حدث خطأ أثناء الحفظ", "error");
    }
};

window.saveWorkoutPlan = async function() {
    if (!currentClientId || !workoutData.schedule) {
        showNotification("❌ لم يتم إدخال بيانات التمارين", "error");
        return;
    }
    
    // التحقق من أن هناك تمرين واحد على الأقل
    let hasExercise = false;
    for (const dayKey in workoutData.schedule) {
        const exercises = workoutData.schedule[dayKey].exercises;
        if (exercises.some(ex => ex.name.trim() !== '')) {
            hasExercise = true;
            break;
        }
    }
    
    if (!hasExercise) {
        showNotification("⚠️ يرجى إضافة تمرين واحد على الأقل", "error");
        return;
    }
    
    try {
        // تحويل البيانات إلى نص منسق للعرض
        const workoutText = [];
        
        for (let i = 1; i <= selectedWorkoutDays; i++) {
            const dayKey = `day${i}`;
            const dayData = workoutData.schedule[dayKey];
            
            workoutText.push(`═══════════════════════════════════`);
            workoutText.push(`📅 اليوم ${i} - ${dayData.dayName}`);
            workoutText.push(`═══════════════════════════════════\n`);
            
            dayData.exercises.forEach((exercise, index) => {
                if (exercise.name.trim()) {
                    workoutText.push(`${index + 1}. ${exercise.name}`);
                    if (exercise.link) workoutText.push(`   🔗 الرابط: ${exercise.link}`);
                    if (exercise.sets) workoutText.push(`   💪 المجموعات: ${exercise.sets}`);
                    if (exercise.reps) workoutText.push(`   🔢 التكرارات: ${exercise.reps}`);
                    if (exercise.rest) workoutText.push(`   ⏱️ الراحة: ${exercise.rest} ثانية`);
                    workoutText.push('');
                }
            });
            
            workoutText.push('');
        }
        
        const workoutString = workoutText.join('\n');
        
        await updateDoc(doc(db, "plans", currentClientId), {
            workout: workoutString,
            workoutTableData: JSON.stringify(workoutData),
            lastUpdated: new Date().toLocaleString('ar-SA')
        });
        
        showNotification(`✅ تم حفظ جدول التمارين للمتدرب "${currentClientId}"`, "success");
        closeModal();
        loadClients();
        
    } catch (error) {
        console.error("❌ خطأ في الحفظ:", error);
        showNotification("حدث خطأ أثناء الحفظ", "error");
    }
};

window.closeModal = function() {
    document.getElementById('planModal').style.display = 'none';
    currentClientId = null;
    currentClientData = null;
    currentPlanType = null;
    selectedWorkoutDays = 0;
    workoutData = {};
    
    // مسح المدخلات
    for (let i = 1; i <= 6; i++) {
        const mealInput = document.getElementById(`meal${i}`);
        if (mealInput) mealInput.value = '';
    }
};

window.logout = function() {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        if (unsubscribeClients) unsubscribeClients();
        
        signOut(auth)
            .then(() => {
                showNotification("✅ تم تسجيل الخروج", "success", 1000);
                setTimeout(() => window.location.href = "login.html", 1000);
            })
            .catch((error) => {
                console.error("❌ خطأ في تسجيل الخروج:", error);
                showNotification("حدث خطأ أثناء تسجيل الخروج", "error");
            });
    }
};
window.showClientInfo = async function(clientId) {
    try {
        const docSnap = await getDoc(doc(db, "plans", clientId));
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const infoHTML = `
                <div style="padding: 30px; max-width: 1200px; width: 95%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                        <h3 style="color: #2c3e50; margin: 0;">
                            <i class="fas fa-user-circle"></i> معلومات المتدرب: ${data.name || data.fullName || 'غير محدد'}
                        </h3>
                        <button onclick="this.closest('.modal-content')?.remove() || this.closest('[style*=\"position: fixed\"]')?.remove()" 
                                style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 20px;">
                            ✖
                        </button>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 20px;">
                        
                        <!-- البيانات الشخصية -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">
                            <h4 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-user"></i> البيانات الشخصية
                            </h4>
                            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                                <p style="margin: 8px 0;"><strong>👤 الاسم:</strong> ${data.name || data.fullName || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>📧 الإيميل:</strong> ${data.email || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>📱 الهاتف:</strong> ${data.phone || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>🎂 العمر:</strong> ${data.age || 'غير محدد'} سنة</p>
                                <p style="margin: 8px 0;"><strong>⚧ الجنس:</strong> ${data.gender || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>🌍 البلد:</strong> ${data.country || 'غير محدد'}</p>
                            </div>
                        </div>

                        <!-- البيانات الصحية -->
                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; color: white;">
                            <h4 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-heartbeat"></i> البيانات الصحية
                            </h4>
                            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                                <p style="margin: 8px 0;"><strong>⚖️ الوزن:</strong> ${data.weight || 'غير محدد'} كجم</p>
                                <p style="margin: 8px 0;"><strong>📏 الطول:</strong> ${data.height || 'غير محدد'} سم</p>
                                <p style="margin: 8px 0;"><strong>📊 BMI:</strong> ${data.bmi || 'غير محسوب'}</p>
                                <p style="margin: 8px 0;"><strong>🏥 أمراض مزمنة:</strong> ${data.chronicDiseases || 'لا يوجد'}</p>
                                <p style="margin: 8px 0;"><strong>🚫 حساسية طعام:</strong> ${data.foodAllergies || 'لا يوجد'}</p>
                                <p style="margin: 8px 0;"><strong>🚬 التدخين:</strong> ${data.smoking || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>🍺 الكحول:</strong> ${data.alcohol || 'غير محدد'}</p>
                            </div>
                        </div>

                        <!-- بيانات التدريب -->
                        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; color: white;">
                            <h4 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-dumbbell"></i> بيانات التدريب
                            </h4>
                            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                                <p style="margin: 8px 0;"><strong>🎯 الهدف:</strong> ${data.goal || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>💪 الخبرة:</strong> ${data.experience || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>📆 سنوات التدريب:</strong> ${data.trainingYears || 0} سنة</p>
                                <p style="margin: 8px 0;"><strong>📅 أيام متاحة:</strong> ${data.availableDays || 'غير محدد'} أيام/أسبوع</p>
                                <p style="margin: 8px 0;"><strong>🏋️ الأجهزة المتاحة:</strong> ${data.gymEquipment ? (Array.isArray(data.gymEquipment) ? data.gymEquipment.join(', ') : data.gymEquipment) : 'غير محدد'}</p>
                            </div>
                        </div>

                        <!-- معلومات إضافية -->
                        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 20px; border-radius: 12px; color: white;">
                            <h4 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-info-circle"></i> معلومات إضافية
                            </h4>
                            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                                <p style="margin: 8px 0;"><strong>🍽️ الأطعمة المفضلة:</strong> ${data.favoriteFoods || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>🎟️ كود الخصم:</strong> ${data.discountCode || 'لا يوجد'}</p>
                                <p style="margin: 8px 0;"><strong>📅 تاريخ التسجيل:</strong> ${data.createdAt || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>🔄 آخر تحديث:</strong> ${data.lastUpdated || 'غير محدد'}</p>
                                <p style="margin: 8px 0;"><strong>📊 الحالة:</strong> ${data.isActive !== false ? '✅ نشط' : '⏸️ متوقف'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- النظام الغذائي -->
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-right: 4px solid #28a745;">
                        <h4 style="color: #28a745; margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-utensils"></i> النظام الغذائي
                        </h4>
                        <div style="background: white; padding: 15px; border-radius: 8px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; color: #2c3e50;">
                            ${data.diet || 'لم يتم تعيين نظام غذائي بعد'}
                        </div>
                    </div>

                    <!-- جدول التمارين -->
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-right: 4px solid #007bff;">
                        <h4 style="color: #007bff; margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-clipboard-list"></i> جدول التمارين
                        </h4>
                        <div style="background: white; padding: 15px; border-radius: 8px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; color: #2c3e50;">
                            ${data.workout || 'لم يتم تعيين تمارين بعد'}
                        </div>
                    </div>
                    
                    <!-- الأزرار -->
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                        <button onclick="copyToClipboard('${data.email || ''}')" 
                                style="padding: 12px 25px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; display: flex; align-items: center; gap: 8px; transition: all 0.3s;">
                            <i class="fas fa-copy"></i> نسخ الإيميل
                        </button>
                    </div>
                </div>
            `;
            
            showCustomModal(infoHTML);
        } else {
            alert('لم يتم العثور على بيانات المتدرب');
        }
    } catch (error) {
        console.error("Error fetching client data:", error);
        alert('حدث خطأ في تحميل البيانات');
    }
};

// دالة نسخ النص
function copyToClipboard(text) {
    if (!text) {
        alert('لا يوجد إيميل للنسخ');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        alert('تم نسخ الإيميل بنجاح! ✅');
    }).catch(err => {
        console.error('فشل النسخ:', err);
        alert('فشل نسخ الإيميل');
    });
}



function showCustomModal(contentHTML) {
    const existingModal = document.getElementById('customModal');
    if (existingModal) existingModal.remove();
    
    const modalDiv = document.createElement('div');
    modalDiv.id = 'customModal';
    modalDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
        background: white;
        padding: 0;
        border-radius: 15px;
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
    `;
    
    contentDiv.innerHTML = contentHTML;
    modalDiv.appendChild(contentDiv);
    document.body.appendChild(modalDiv);
    
    modalDiv.addEventListener('click', function(e) {
        if (e.target === modalDiv) {
            modalDiv.remove();
        }
    });
}

window.copyToClipboard = function(text) {
    if (!text) {
        showNotification("❌ لا يوجد نص للنسخ", "error");
        return;
    }
    
    navigator.clipboard.writeText(text)
        .then(() => {
            showNotification("✅ تم نسخ النص", "success");
        })
        .catch(() => {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showNotification("✅ تم نسخ النص", "success");
        });
};

onAuthStateChanged(auth, async (user) => {
    console.log("=== 🔐 نظام التحقق ===");
    
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    if (user.email === "admin@gym.com") {
        console.log("🎉 أهلاً بالأدمن!");
        
        if (unsubscribeClients) unsubscribeClients();
        
        loadClients();
        
        unsubscribeClients = onSnapshot(collection(db, "plans"), () => {
            console.log("🔄 تحديث تلقائي لقائمة المتدربين");
            loadClients();
        });
        
    } else {
        console.log("🚫 ليس أدمن - توجيه لـ client.html");
        showNotification(`⛔ ليس لديك صلاحية الدخول`, "error", 2000);
        setTimeout(() => window.location.href = "client.html", 2000);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('planModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            const notification = document.querySelector('.notification');
            if (notification) notification.remove();
        }
    });
});

window.addEventListener('beforeunload', () => {
    if (unsubscribeClients) unsubscribeClients();
});
