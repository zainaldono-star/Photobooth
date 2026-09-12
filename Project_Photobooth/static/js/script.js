const video = document.getElementById('video');
const singleFrameOverlay = document.getElementById('singleFrameOverlay');
const captureBtn = document.getElementById('captureBtn');
const flashEl = document.getElementById('flash');
const resultModal = document.getElementById('resultModal');
const resultImage = document.getElementById('resultImage');
const downloadLink = document.getElementById('downloadLink');
const retakeBtn = document.getElementById('retakeBtn');

const TOTAL_PHOTOS = 8;
const COUNTDOWN_SECONDS = 5; // Hitung mundur 5 4 3 2 1 untuk setiap foto

let currentTheme = '1';
let currentFilter = 'none';
let isCapturing = false;

// ─── 1. Inisialisasi Kamera ───────────────────────────────────────
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
    } catch (err) {
        alert("Gagal mengakses kamera: " + err.message);
    }
}
initCamera();

// ─── 2. Pilih Tema ────────────────────────────────────────────────
document.querySelectorAll('#themeOptions .option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#themeOptions .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTheme = e.target.dataset.value;
        singleFrameOverlay.src = `/static/frames/frame_single_${currentTheme}.png`;
    });
});

// ─── 3. Pilih Filter ─────────────────────────────────────────────
document.querySelectorAll('#filterOptions .option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#filterOptions .option-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.value;
        video.style.filter = currentFilter;
    });
});

// ─── 4. Hitung Mundur (5 → 4 → 3 → 2 → 1) ──────────────────────
function showCountdown(startNum) {
    return new Promise(resolve => {
        const cdEl = document.getElementById('countdown');
        let num = startNum;

        // Tampilkan angka pertama
        cdEl.innerText = num;
        cdEl.style.display = 'block';

        const timer = setInterval(() => {
            num--;
            if (num > 0) {
                cdEl.innerText = num;
            } else {
                clearInterval(timer);
                cdEl.style.display = 'none';
                resolve();
            }
        }, 1000);
    });
}

// ─── 5. Efek Flash Kamera ─────────────────────────────────────────
function triggerFlash() {
    flashEl.style.opacity = 1;
    setTimeout(() => { flashEl.style.opacity = 0; }, 200);
}

// ─── 6. Update Progress (Tanpa Badge Visual) ──────────────────────
function updateProgress(current, total) {
    // Dipanggil saat iterasi foto
}

// ─── 7. Capture Satu Frame Foto ──────────────────────────────────
function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const videoRatio = vw / vh;
    const canvasRatio = canvas.width / canvas.height;

    let sWidth, sHeight, sx, sy;
    if (videoRatio > canvasRatio) {
        sHeight = vh; sWidth = sHeight * canvasRatio;
        sx = (vw - sWidth) / 2; sy = 0;
    } else {
        sWidth = vw; sHeight = sWidth / canvasRatio;
        sx = 0; sy = (vh - sHeight) / 2;
    }

    // Mirror effect (kamera depan selfie)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    if (currentFilter !== 'none') ctx.filter = currentFilter;

    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
}

// ─── 8. Tombol MULAI 8 FOTO ──────────────────────────────────────
captureBtn.addEventListener('click', async () => {
    if (isCapturing) return;
    isCapturing = true;
    captureBtn.disabled = true;
    captureBtn.innerText = "SEDANG MENGAMBIL FOTO...";

    // Nonaktifkan tombol opsi saat sesi foto berlangsung
    document.querySelectorAll('#themeOptions .option-btn, #filterOptions .option-btn')
        .forEach(btn => btn.disabled = true);

    const photos = [];

    // Mengambil 8 FOTO secara berurutan dengan hitungan mundur 5 4 3 2 1
    for (let i = 1; i <= TOTAL_PHOTOS; i++) {
        // Tampilkan urutan foto (Foto 1 / 8, Foto 2 / 8, dst)
        updateProgress(i, TOTAL_PHOTOS);

        // Hitung mundur 5, 4, 3, 2, 1 untuk SETIAP FOTO
        await showCountdown(COUNTDOWN_SECONDS);

        // Jepret foto + efek flash
        triggerFlash();
        const photoData = captureFrame();
        photos.push(photoData);

        // Jeda 800ms antar foto agar pengguna punya waktu bersiap posisi baru
        if (i < TOTAL_PHOTOS) {
            await new Promise(r => setTimeout(r, 800));
        }
    }

    // Selesai jepret 8 foto, sembunyikan progress & kirim ke server
    updateProgress(0, TOTAL_PHOTOS);
    captureBtn.innerText = "MEMPROSES FOTO...";

    try {
        const response = await fetch('/save_photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photos: photos, theme: currentTheme })
        });

        if (!response.ok) {
            let errorMsg = `Server HTTP Error ${response.status}`;
            if (response.status === 413) {
                errorMsg = "Ukuran foto terlalu besar untuk server.";
            } else {
                try {
                    const errData = await response.json();
                    if (errData.error) errorMsg = errData.error;
                } catch (_) {}
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (data.success) {
            resultImage.src = data.image_data;
            downloadLink.href = data.image_data;
            downloadLink.download = "photobooth.jpg";
            resultModal.style.display = 'flex';
        } else {
            alert("Gagal memproses foto: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        alert("Gagal mengirim foto: " + e.message);
    } finally {
        isCapturing = false;
        captureBtn.disabled = false;
        captureBtn.innerText = "MULAI FOTO";
        document.querySelectorAll('#themeOptions .option-btn, #filterOptions .option-btn')
            .forEach(btn => btn.disabled = false);
    }
});

// ─── 9. Tombol Foto Lagi ─────────────────────────────────────────
retakeBtn.addEventListener('click', () => {
    resultModal.style.display = 'none';
    resultImage.src = '';
});