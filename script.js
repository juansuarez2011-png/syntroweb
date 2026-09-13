// ========================================
// SYNTRO — Panel oculto con contraseña
// Abre con: Ctrl + Shift + S
// ========================================

const DB_NAME = 'syntro_db';
const DB_VERSION = 2;
const STORE_NAME = 'archivos';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// 🔐 CONTRASEÑA DEL ADMINISTRADOR — CAMBIA ESTO POR LA QUE QUIERAS
const PASSWORD_ADMIN = 'syntro2025';

let db;
let isAdmin = false;

// ---------- Base de datos ----------
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (database.objectStoreNames.contains(STORE_NAME)) {
                database.deleteObjectStore(STORE_NAME);
            }
            database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        };
    });
}

function saveFile(file) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record = {
            name: file.name,
            type: file.type,
            size: file.size,
            blob: file,
            date: new Date().toISOString()
        };
        const req = store.add(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAllFiles() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function deleteFile(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function clearAll() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ========================================
// Interfaz
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const gallery = document.getElementById('gallery');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn = document.getElementById('clear-btn');
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.querySelector('.modal-close');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const uploadPanel = document.getElementById('upload-panel');
    const closePanel = document.getElementById('close-panel');
    const logoutBtn = document.getElementById('logout-btn');

    // Elementos del modal de contraseña
    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordCancel = document.getElementById('password-cancel');
    const passwordError = document.getElementById('password-error');

    let currentFilter = 'all';
    const urlCache = new Map();

    // ========================================
    // ATAJOS DE TECLADO
    // ========================================
    document.addEventListener('keydown', (e) => {
        // Ctrl + Shift + S → abrir modal de contraseña
        if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
            e.preventDefault();
            if (isAdmin) {
                // Si ya está logueado, abrir el panel directamente
                uploadPanel.classList.add('visible');
            } else {
                // Si no, pedir contraseña
                passwordModal.classList.add('active');
                passwordError.textContent = '';
                passwordInput.value = '';
                setTimeout(() => passwordInput.focus(), 100);
            }
        }
        // ESC → cerrar todo
        if (e.key === 'Escape') {
            if (modal.classList.contains('active')) {
                modal.classList.remove('active');
                modalContent.innerHTML = '';
            }
            if (uploadPanel.classList.contains('visible')) {
                uploadPanel.classList.remove('visible');
            }
            if (passwordModal.classList.contains('active')) {
                passwordModal.classList.remove('active');
            }
        }
    });

    // ========================================
    // MODAL DE CONTRASEÑA
    // ========================================
    passwordSubmit.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkPassword();
    });

    passwordCancel.addEventListener('click', () => {
        passwordModal.classList.remove('active');
        passwordError.textContent = '';
        passwordInput.value = '';
    });

    function checkPassword() {
        const valor = passwordInput.value.trim();
        if (valor === PASSWORD_ADMIN) {
            isAdmin = true;
            document.body.classList.add('admin-mode');
            passwordModal.classList.remove('active');
            passwordError.textContent = '';
            passwordInput.value = '';
            uploadPanel.classList.add('visible');
            console.log('✅ Sesión de admin iniciada');
        } else {
            passwordError.textContent = '❌ Contraseña incorrecta';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    // Botón cerrar sesión    logoutBtn.addEventListener('click', () => {
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        uploadPanel.classList.remove('visible');
        renderGallery();
        console.log('🚪 Sesión cerrada');
    });

    // Botón de cerrar panel
    closePanel.addEventListener('click', () => {
        uploadPanel.classList.remove('visible');
    });

    uploadPanel.addEventListener('click', (e) => {
        if (e.target === uploadPanel) {
            uploadPanel.classList.remove('visible');
        }
    });

    // ========================================
    // Galería
    // ========================================
    async function renderGallery() {
        const files = await getAllFiles();
        gallery.innerHTML = '';

        const filtered = files.filter(f => {
            if (currentFilter === 'all') return true;
            return f.type.startsWith(currentFilter + '/');
        });

        if (filtered.length === 0) {
            gallery.innerHTML = '<p class="empty-msg">Pronto habrá contenido nuevo en nuestra galería 🌱</p>';
            return;
        }

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(file => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            let url = urlCache.get(file.id);
            if (!url) {
                url = URL.createObjectURL(file.blob);
                urlCache.set(file.id, url);
            }

            let media;
            if (file.type.startsWith('image/')) {
                media = document.createElement('img');
                media.src = url;
                media.alt = file.name;
                media.loading = 'lazy';
            } else {
                media = document.createElement('video');
                media.src = url;
                media.muted = true;
                media.preload = 'metadata';
            }

            media.addEventListener('click', () => openModal(file, url));

            const overlay = document.createElement('div');
            overlay.className = 'item-overlay';
            overlay.innerHTML = `
                <span>${file.type.startsWith('image/') ? '📷' : '🎬'} ${(file.size/1024/1024).toFixed(2)} MB</span>
                <button class="item-delete" title="Eliminar">×</button>
            `;

            overlay.querySelector('.item-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!isAdmin) return; // Solo admin puede borrar
                if (confirm('¿Eliminar este archivo?')) {
                    const cachedUrl = urlCache.get(file.id);
                    if (cachedUrl) {
                        URL.revokeObjectURL(cachedUrl);
                        urlCache.delete(file.id);
                    }
                    await deleteFile(file.id);
                    renderGallery();
                }
            });

            item.appendChild(media);
            item.appendChild(overlay);
            gallery.appendChild(item);
        });
    }

    function openModal(file, url) {
        modalContent.innerHTML = '';
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = url;
            modalContent.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.autoplay = true;
            modalContent.appendChild(video);
        }
        modal.classList.add('active');
    }

    modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
        modalContent.innerHTML = '';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modalContent.innerHTML = '';
        }
    });

    // ========================================
    // Subida
    // ========================================
    uploadBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        await handleFiles(e.target.files);
        fileInput.value = '';
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone--over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('drop-zone--over');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone--over');
        if (e.dataTransfer.files.length) {
            await handleFiles(e.dataTransfer.files);
        }
    });

    async function handleFiles(files) {
        if (!isAdmin) {
            alert('⚠️ Solo el administrador puede subir archivos.');
            return;
        }

        const progressBar = document.getElementById('progress-bar');
        const progressFill = document.getElementById('progress-fill');
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';

        const allFiles = [...files];
        const validFiles = [];
        const rejectedFiles = [];

        allFiles.forEach(f => {
            if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
                rejectedFiles.push(`${f.name} (formato no permitido)`);
                return;
            }
            if (f.size > MAX_FILE_SIZE) {
                rejectedFiles.push(`${f.name} (${(f.size/1024/1024).toFixed(1)} MB - supera 100 MB)`);
                return;
            }
            validFiles.push(f);
        });

        if (rejectedFiles.length > 0) {
            alert('⚠️ Algunos archivos no se subieron:\n\n' + rejectedFiles.join('\n'));
        }

        if (validFiles.length === 0) {
            progressBar.style.display = 'none';
            return;
        }

        let done = 0;
        for (const file of validFiles) {
            try {
                await saveFile(file);
                done++;
                progressFill.style.width = `${(done / validFiles.length) * 100}%`;
            } catch (err) {
                console.error('Error:', err);
                alert('Error al guardar: ' + file.name);
            }
        }

        setTimeout(() => {
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
        }, 600);

        await renderGallery();
    }

    clearBtn.addEventListener('click', async () => {
        if (!isAdmin) return;
        if (confirm('¿Eliminar TODOS los archivos?')) {
            urlCache.forEach(url => URL.revokeObjectURL(url));
            urlCache.clear();
            await clearAll();
            renderGallery();
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderGallery();
        });
    });

    await renderGallery();
    console.log('🌱 SYNTRO listo. Presiona Ctrl + Shift + S para acceder al panel.');
});