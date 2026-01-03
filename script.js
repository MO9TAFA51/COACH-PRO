import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs,
    updateDoc,
    query,
    where
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
            
            const createdDate = data.createdAt || "غير محدد";
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

window.createClientData = async function(clientId, email) {
    if (!confirm(`هل تريد إنشاء بيانات للمتدرب "${clientId}"؟`)) return;
    
    try {
        await updateDoc(doc(db, "plans", clientId), {
            email: email || `${clientId}@gym.com`,
            name: clientId,
            goal: "فقدان الوزن",
            diet: "لم يتم تعيين نظام غذائي بعد",
            workout: "لم يتم تعيين تمارين بعد",
            isActive: true,
            createdAt: new Date().toLocaleString('ar-SA'),
            lastUpdated: new Date().toLocaleString('ar-SA')
        }, { merge: true });
        
        showNotification(`✅ تم إنشاء بيانات للمتدرب "${clientId}"`, "success");
        loadClients();
        
    } catch (error) {
        console.error("❌ خطأ في إنشاء البيانات:", error);
        showNotification("❌ حدث خطأ في إنشاء البيانات", "error");
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
        
        addRefreshButton();
        
    } else {
        console.log("🚫 ليس أدمن - توجيه لـ client.html");
        showNotification(`⛔ ليس لديك صلاحية الدخول`, "error", 2000);
        setTimeout(() => window.location.href = "client.html", 2000);
    }
});

function addRefreshButton() {
    const header = document.querySelector('header');
    if (!header) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn-refresh';
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> تحديث';
    refreshBtn.onclick = loadClients;
    refreshBtn.style.cssText = 'margin-right:10px; background:#666;';
    
    const actionsDiv = header.querySelector('.header-actions') || header;
    actionsDiv.insertBefore(refreshBtn, actionsDiv.firstChild);
}

window.openPlanModal = async function(clientId) {
    console.log("✏️ فتح تعديل نظام:", clientId);
    
    document.getElementById('clientNameDisplay').textContent = clientId;
    document.getElementById('planModal').style.display = 'block';
    
    try {
        const docSnap = await getDoc(doc(db, "plans", clientId));
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('dietPlan').value = data.diet || '';
            document.getElementById('workoutPlan').value = data.workout || '';
            
            const planForm = document.getElementById('planForm');
            planForm.dataset.clientId = clientId;
            planForm.dataset.clientEmail = data.email || '';
            
        } else {
            showNotification("❌ المشترك غير موجود!", "error");
            closeModal();
        }
    } catch (error) {
        console.error("❌ خطأ في تحميل البيانات:", error);
        showNotification("حدث خطأ في تحميل البيانات", "error");
    }
};

window.closeModal = function() {
    document.getElementById('planModal').style.display = 'none';
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
                <div style="padding: 20px; max-width: 500px;">
                    <h3 style="color: #2c3e50; margin-bottom: 20px;">
                        <i class="fas fa-user-circle"></i> معلومات المتدرب
                    </h3>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <p><strong>👤 الاسم:</strong> ${data.name || clientId}</p>
                        <p><strong>📧 الإيميل:</strong> ${data.email || "غير محدد"}</p>
                        <p><strong>🎯 الهدف:</strong> ${data.goal || "غير محدد"}</p>
                        <p><strong>📅 تاريخ التسجيل:</strong> ${data.createdAt || "غير محدد"}</p>
                        <p><strong>🔄 آخر تحديث:</strong> ${data.lastUpdated || "غير محدد"}</p>
                        <p><strong>📊 الحالة:</strong> ${data.isActive !== false ? '✅ نشط' : '⏸️ متوقف'}</p>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="copyToClipboard('${data.email || ''}')" 
                                style="padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            📋 نسخ الإيميل
                        </button>
                        <button onclick="this.parentElement.parentElement.remove()" 
                                style="padding: 10px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            إغلاق
                        </button>
                    </div>
                </div>
            `;
            
            showCustomModal(infoHTML);
        }
    } catch (error) {
        console.error("❌ خطأ في عرض المعلومات:", error);
        showNotification("حدث خطأ في عرض المعلومات", "error");
    }
};

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
            showNotification("✅ تم نسخ النص: " + text, "success");
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

window.debugFirestore = async function() {
    console.log("=== 🔍 فحص قاعدة البيانات ===");
    
    try {
        const querySnapshot = await getDocs(collection(db, "plans"));
        
        console.log("📊 جميع المستندات في collection 'plans':");
        console.log("=========================================");
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log(`📄 Document ID: "${docSnap.id}"`);
            console.log("📋 البيانات:", data);
            console.log("-----------------------------------------");
        });
        
        alert(`✅ تم فحص قاعدة البيانات\nعدد المستندات: ${querySnapshot.size}\nافتح Console (F12) لرؤية التفاصيل`);
        
    } catch (error) {
        console.error("❌ خطأ في الفحص:", error);
        alert("❌ حدث خطأ في فحص البيانات");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const planForm = document.getElementById('planForm');
    
    if (planForm) {
        planForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const clientId = planForm.dataset.clientId;
            const diet = document.getElementById('dietPlan').value;
            const workout = document.getElementById('workoutPlan').value;
            
            if (!clientId) {
                showNotification("❌ لم يتم تحديد متدرب", "error");
                return;
            }
            
            try {
                await updateDoc(doc(db, "plans", clientId), {
                    diet: diet,
                    workout: workout,
                    lastUpdated: new Date().toLocaleString('ar-SA')
                });
                
                showNotification(`✅ تم حفظ النظام للمتدرب "${clientId}"`, "success");
                closeModal();
                loadClients();
                
            } catch (error) {
                console.error("❌ خطأ في الحفظ:", error);
                showNotification("حدث خطأ أثناء الحفظ", "error");
            }
        });
    }
    
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
    
    setInterval(() => {
        if (auth.currentUser && auth.currentUser.email === "admin@gym.com") {
            loadClients();
        }
    }, 30000);
});

window.addEventListener('beforeunload', () => {
    if (unsubscribeClients) unsubscribeClients();
});