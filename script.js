document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const previewGallery = document.getElementById('preview-gallery');
    const originalSize = document.getElementById('original-size');
    const originalDimensions = document.getElementById('original-dimensions');
    const resetBtn = document.getElementById('reset-btn');

    const formatSelect = document.getElementById('format-select');
    const qualityGroup = document.getElementById('quality-group');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');

    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');

    // State
    let currentFiles = []; // Array of { file, image, originalName }
    let convertedBlobs = []; // Array of { blob, newFileName }
    let currentObjectUrls = []; // Array of URLs for cleanup

    // Initialization
    function init() {
        setupEventListeners();
    }

    function setupEventListeners() {
        // Drag and Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });

        // File Input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
            }
        });

        // UI Controls
        resetBtn.addEventListener('click', resetWorkspace);

        formatSelect.addEventListener('change', () => {
            // Hide quality slider for PNG as it's lossless
            if (formatSelect.value === 'image/png') {
                qualityGroup.classList.add('hidden');
            } else {
                qualityGroup.classList.remove('hidden');
            }
            hideDownloadBtn();
        });

        qualitySlider.addEventListener('input', (e) => {
            qualityValue.textContent = `${e.target.value}%`;
            hideDownloadBtn();
        });

        // Actions
        convertBtn.addEventListener('click', convertImages);
        downloadBtn.addEventListener('click', downloadConvertedImages);
    }

    // Handlers
    function handleFiles(filesList) {
        const newFiles = Array.from(filesList);

        if (currentFiles.length + newFiles.length > 10) {
            alert('Maksimal 10 gambar yang dapat diproses sekaligus.');
            return;
        }

        // Switch active view
        if (currentFiles.length === 0 && newFiles.length > 0) {
            uploadArea.classList.add('hidden');
            workspace.classList.remove('hidden');
        }

        newFiles.forEach(file => {
            const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
                    currentFiles.push({ file, image: img, originalName });

                    // Render UI thumbnail
                    const item = document.createElement('div');
                    item.className = 'preview-item';
                    item.innerHTML = `
                        <img src="${e.target.result}" alt="${originalName}">
                        <div class="file-name">${file.name}</div>
                    `;
                    previewGallery.appendChild(item);

                    updateStats();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function updateStats() {
        const totalSize = currentFiles.reduce((acc, obj) => acc + obj.file.size, 0);
        originalSize.textContent = `Files: ${currentFiles.length}/10`;
        originalDimensions.textContent = `Total Size: ${formatBytes(totalSize)}`;
    }

    async function convertImages() {
        if (currentFiles.length === 0) return;

        // UI Feedback
        convertBtn.classList.add('loading');
        convertBtn.innerHTML = '<i class="ri-loader-4-line"></i> Converting...';

        // Cleanup old conversions
        convertedBlobs = [];
        currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
        currentObjectUrls = [];

        // Allow UI to flush loading state
        setTimeout(async () => {
            const format = formatSelect.value;
            const quality = parseInt(qualitySlider.value) / 100;
            let extension = format.split('/')[1];
            if (extension === 'jpeg') extension = 'jpg';

            for (let i = 0; i < currentFiles.length; i++) {
                const item = currentFiles[i];
                const canvas = document.createElement('canvas');
                canvas.width = item.image.width;
                canvas.height = item.image.height;
                const ctx = canvas.getContext('2d');

                // If converting to jpeg, fill white background to resolve transparency issues
                if (format === 'image/jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(item.image, 0, 0);

                // Convert using a Promise wrapper to work nicely with await
                const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));

                // Unique name strategy if batching duplicates
                const newFileName = `${item.originalName}_converted.${extension}`;

                convertedBlobs.push({ blob, newFileName });
                currentObjectUrls.push(URL.createObjectURL(blob));
            }

            // Update UI after logic
            downloadBtn.classList.remove('hidden');

            if (convertedBlobs.length > 1) {
                downloadBtn.innerHTML = '<i class="ri-download-2-line"></i> Download ZIP';
            } else {
                downloadBtn.innerHTML = '<i class="ri-download-2-line"></i> Download';
            }

            convertBtn.classList.remove('loading');
            convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Again';

            const totalNewSize = convertedBlobs.reduce((acc, b) => acc + b.blob.size, 0);
            originalDimensions.textContent = `New Total: ${formatBytes(totalNewSize)}`;

        }, 50);
    }

    async function downloadConvertedImages() {
        if (convertedBlobs.length === 0) return;

        if (convertedBlobs.length === 1) {
            // SINGLE FILE DOWNLOAD logic (Standard Browser Download)
            const { blob, newFileName } = convertedBlobs[0];

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = newFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Jeda sedikit sebelum revoke URL agar browser sempat memulai proses download
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        } else {
            // MULTIPLE FILES DOWNLOAD logic via JSZip
            downloadBtn.classList.add('loading');
            downloadBtn.innerHTML = '<i class="ri-loader-4-line"></i> Zipping...';

            setTimeout(async () => {
                try {
                    const zip = new JSZip();
                    convertedBlobs.forEach(item => {
                        zip.file(item.newFileName, item.blob);
                    });

                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const zipName = 'Go_Converter_Images.zip';

                    const url = URL.createObjectURL(zipBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = zipName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                    }, 1000);

                } catch (error) {
                    console.error("Error creating ZIP", error);
                    alert("Terjadi kesalahan saat memproses file ZIP.");
                }

                downloadBtn.classList.remove('loading');
                downloadBtn.innerHTML = '<i class="ri-download-2-line"></i> Download ZIP';
            }, 50);
        }
    }

    function resetWorkspace() {
        // Clear state
        currentFiles = [];
        convertedBlobs = [];
        currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
        currentObjectUrls = [];

        previewGallery.innerHTML = '';
        fileInput.value = '';

        // Reset UI
        uploadArea.classList.remove('hidden');
        workspace.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert';

        // Reset selectors
        formatSelect.value = 'image/jpeg';
        qualitySlider.value = 80;
        qualityValue.textContent = '80%';
        qualityGroup.classList.remove('hidden');
        originalSize.textContent = `Files: 0/10`;
        originalDimensions.textContent = `Selected`;
    }

    function hideDownloadBtn() {
        downloadBtn.classList.add('hidden');
        convertBtn.innerHTML = currentFiles.length > 1 ? '<i class="ri-loop-right-line"></i> Convert Images' : '<i class="ri-loop-right-line"></i> Convert Image';
    }

    // Helper: Format bytes to KB/MB
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Run
    init();
});
