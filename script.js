// ========================================
// SYNTRO - Con Supabase (nube real)
// Eliminación individual y grupal
// ========================================

// 🔑 CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://iwwasjqwftubzuxzvdgw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JwVQwjDOqM4DnMsQ6Lkbtg_tniMyEPa';
const BUCKET_NAME = 'syntro-media';

// 🔐 Contraseña del admin
const PASSWORD_ADMIN = 'syntro2025';

// 📦 Límite archivo: 50 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Inicializar Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isAdmin = false;
let currentFilter = 'all';
let allFiles = [];
let selectionMode = false;
let selectedFiles = new Set();

// ========================================
// INTERFAZ
// ========================================
document.addEventListener('DOMContentLoaded', () => {

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const gallery = document.getElementById('gallery');
    const uploadBtn = document.getElementById('upload-btn');
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.querySelector('.modal-close');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const uploadPanel = document.getElementById('upload-panel');
    const closePanel = document.getElementById('close-panel');
    const logoutBtn = document.getElementById('logout-btn');

    const toggleSelectBtn = document.getElementById('toggle-select-btn');
    const multiActions = document.getElementById('multi-actions');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordCancel = document.getElementById('password-cancel');
    const passwordError = document.getElementById('password-error');

    // ========================================
    // ATAJOS DE TECLADO
    // ========================================
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
            e.preventDefault();
            if (isAdmin) {
                uploadPanel.classList.add('visible');
            } else {
                passwordModal.classList.add('active');
                passwordError.textContent = '';
                passwordInput.value = '';
                setTimeout(() => passwordInput.focus(), 100);
            }
        }
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
    // CONTRASEÑA
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
            uploadPanel.classList.add('visible');
            renderGallery();
        } else {
            passwordError.textContent = '❌ Contraseña incorrecta';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    logoutBtn.addEventListener('click', () => {
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.body.classList.remove('selection-mode');
        selectionMode = false;
        selectedFiles.clear();
        uploadPanel.classList.remove('visible');
        multiActions.style.display = 'none';
        toggleSelectBtn.textContent = '☑️ Modo Selección';
        renderGallery();
    });

    closePanel.addEventListener('click', () => {
        uploadPanel.classList.remove('visible');
    });

    uploadPanel.addEventListener('click', (e) => {
        if (e.target === uploadPanel) {
            uploadPanel.classList.remove('visible');
        }
    });

    // ========================================
    // MODO SELECCIÓN
    // ========================================
    toggleSelectBtn.addEventListener('click', () => {
        selectionMode = !selectionMode;
        if (selectionMode) {
            document.body.classList.add('selection-mode');
            multiActions.style.display = 'flex';
            toggleSelectBtn.textContent = '✖️ Salir de Selección';
        } else {
            document.body.classList.remove('selection-mode');
            multiActions.style.display = 'none';
            toggleSelectBtn.textContent = '☑️ Modo Selección';
            selectedFiles.clear();
            updateSelectedCount();
            renderGallery();
        }
    });

    selectAllBtn.addEventListener('click', () => {
        allFiles.forEach(f => selectedFiles.add(f.name));
        updateSelectedCount();
        renderGallery();
    });

    deselectAllBtn.addEventListener('click', () => {
        selectedFiles.clear();
        updateSelectedCount();
        renderGallery();
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        if (selectedFiles.size === 0) {
            alert('No has seleccionado ningún archivo.');
            return;
        }
        const total = selectedFiles.size;
        if (!confirm(`¿Eliminar ${total} archivo(s)?\n\nEsta acción no se puede deshacer.`)) return;

        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.textContent = '⏳ Eliminando...';

        try {
            const names = Array.from(selectedFiles);
            const { error } = await supabaseClient
                .storage
                .from(BUCKET_NAME)
                .remove(names);

            if (error) throw error;

            selectedFiles.clear();
            updateSelectedCount();
            await loadFilesFromSupabase();
            alert(`✅ ${total} archivo(s) eliminado(s) correctamente.`);
        } catch (err) {
            alert('❌ Error al eliminar: ' + (err.message || err));
        } finally {
            deleteSelectedBtn.disabled = false;
            updateSelectedCount();
        }
    });

    function updateSelectedCount() {
        deleteSelectedBtn.disabled = selectedFiles.size === 0;
        deleteSelectedBtn.innerHTML = `🗑️ Eliminar Seleccionados (${selectedFiles.size})`;
    }

    // ========================================
    // GALERÍA (LEE DE SUPABASE)
    // ========================================
    async function loadFilesFromSupabase() {
        try {
            const { data, error } = await supabaseClient
                .storage
                .from(BUCKET_NAME)
                .list('', {
                    limit: 1000,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) throw error;

            allFiles = (data || []).filter(f => f.name && f.name !== '.emptyFolderPlaceholder').map(f => {
                const { data: urlData } = supabaseClient
                    .storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(f.name);

                const ext = f.name.split('.').pop().toLowerCase();
                const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(ext);

                return {
                    name: f.name,
                    url: urlData.publicUrl,
                    type: isVideo ? 'video' : 'image',
                    date: f.created_at,
                    size: f.metadata ? f.metadata.size : 0
                };
            });

            renderGallery();
        } catch (err) {
            console.error('Error:', err);
            gallery.innerHTML = '<p class="empty-msg">Error al cargar. Verifica tu conexión.</p>';
        }
    }

    function renderGallery() {
        gallery.innerHTML = '';

        const filtered = allFiles.filter(f => {
            if (currentFilter === 'all') return true;
            return f.type === currentFilter;
        });

        if (filtered.length === 0) {
            gallery.innerHTML = '<p class="empty-msg">Pronto habrá contenido nuevo en nuestra galería 🌱</p>';
            return;
        }

        filtered.forEach(file => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            if (selectedFiles.has(file.name)) {
                item.classList.add('selected');
            }

            let media;
            if (file.type === 'image') {
                media = document.createElement('img');
                media.src = file.url;
                media.alt = file.name;
                media.loading = 'lazy';
            } else {
                media = document.createElement('video');
                media.src = file.url;
                media.muted = true;
                media.preload = 'metadata';
            }

            media.addEventListener('click', (e) => {
                if (selectionMode) {
                    e.stopPropagation();
                    toggleSelection(file.name, item);
                } else {
                    openModal(file);
                }
            });

            const checkbox = document.createElement('div');
            checkbox.className = 'item-checkbox';
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelection(file.name, item);
            });

            const overlay = document.createElement('div');
            overlay.className = 'item-overlay';
            const sizeMB = file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '';
            overlay.innerHTML = `
                <span>${file.type === 'image' ? '📷' : '🎬'} ${sizeMB}</span>
                <button class="item-delete" title="Eliminar">×</button>
            `;

            overlay.querySelector('.item-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!isAdmin) return;
                if (confirm(`¿Eliminar este archivo?\n\n${file.name}`)) {
                    const { error } = await supabaseClient
                        .storage
                        .from(BUCKET_NAME)
                        .remove([file.name]);

                    if (error) {
                        alert('Error al eliminar: ' + error.message);
                        return;
                    }
                    loadFilesFromSupabase();
                }
            });

            item.appendChild(media);
            item.appendChild(checkbox);
            item.appendChild(overlay);
            gallery.appendChild(item);
        });
    }

    function toggleSelection(fileName, itemElement) {
        if (selectedFiles.has(fileName)) {
            selectedFiles.delete(fileName);
            itemElement.classList.remove('selected');
        } else {
            selectedFiles.add(fileName);
            itemElement.classList.add('selected');
        }
        updateSelectedCount();
    }

    function openModal(file) {
        modalContent.innerHTML = '';
        if (file.type === 'image') {
            const img = document.createElement('img');
            img.src = file.url;
            modalContent.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = file.url;
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
    // SUBIR ARCHIVOS
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
        if (!isAdmin) return;

        const progressBar = document.getElementById('progress-bar');
        const progressFill = document.getElementById('progress-fill');
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';

        const allFilesArray = [...files];
        const validFiles = [];
        const rejected = [];

        allFilesArray.forEach(f => {
            if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
                rejected.push(`${f.name} (formato no permitido)`);
                return;
            }
            if (f.size > MAX_FILE_SIZE) {
                rejected.push(`${f.name} (${(f.size/1024/1024).toFixed(1)} MB - supera 50 MB)`);
                return;
            }
            validFiles.push(f);
        });

        if (rejected.length) {
            alert('⚠️ Algunos archivos no se subieron:\n\n' + rejected.join('\n'));
        }
        if (!validFiles.length) {
            progressBar.style.display = 'none';
            return;
        }

        let done = 0;
        for (const file of validFiles) {
            try {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

                const { error } = await supabaseClient
                    .storage
                    .from(BUCKET_NAME)
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) throw error;

                done++;
                progressFill.style.width = `${(done / validFiles.length) * 100}%`;
            } catch (err) {
                console.error('Error subiendo:', err);
                alert('Error al subir: ' + file.name + '\n' + (err.message || err));
            }
        }

        setTimeout(() => {
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
        }, 600);

        await loadFilesFromSupabase();
    }

    // ========================================
    // FILTROS
    // ========================================
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderGallery();
        });
    });

    // ========================================
    // INICIO
    // ========================================
    loadFilesFromSupabase();
    console.log('🌱 SYNTRO + Supabase listo. Ctrl + Shift + S para panel admin.');
});
