document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const previewImage = document.getElementById('preview-image');
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
    let currentImage = null;
    let originalFile = null;
    let convertedBlob = null;
    let currentObjectUrl = null; // For cleanup

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
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // File Input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
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
        convertBtn.addEventListener('click', convertImage);
        downloadBtn.addEventListener('click', downloadConvertedImage);
    }

    // Handlers
    function handleFile(file) {
        // Validate
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image file (JPG, PNG, or WEBP).');
            return;
        }

        originalFile = file;

        // Show info
        originalSize.textContent = `Size: ${formatBytes(file.size)}`;

        // Read image to get dimensions and preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                originalDimensions.textContent = `${img.width} x ${img.height}`;
                previewImage.src = e.target.result;

                // Switch view
                uploadArea.classList.add('hidden');
                workspace.classList.remove('hidden');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function convertImage() {
        if (!currentImage) return;

        // UI Feedback
        convertBtn.classList.add('loading');
        convertBtn.innerHTML = '<i class="ri-loader-4-line"></i> Converting...';

        // Use setTimeout to allow UI to update before heavy work
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = currentImage.width;
            canvas.height = currentImage.height;

            const ctx = canvas.getContext('2d');

            // If converting TO jpeg from transparent PNG/WEBP, background will be black
            // Better to fill with white before drawing
            if (formatSelect.value === 'image/jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw original image
            ctx.drawImage(currentImage, 0, 0);

            // Get format and quality
            const format = formatSelect.value;
            const quality = parseInt(qualitySlider.value) / 100;

            canvas.toBlob((blob) => {
                convertedBlob = blob;

                // Show download button
                downloadBtn.classList.remove('hidden');

                // Update preview with converted form
                if (currentObjectUrl) {
                    URL.revokeObjectURL(currentObjectUrl);
                }
                currentObjectUrl = URL.createObjectURL(blob);
                previewImage.src = currentObjectUrl;

                // Update size to new size
                originalSize.textContent = `New Size: ${formatBytes(blob.size)}`;

                // Reset convert button
                convertBtn.classList.remove('loading');
                convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Again';

            }, format, quality);

        }, 50); // Small delay for UI update
    }

    async function downloadConvertedImage() {
        if (!convertedBlob) return;

        let extension = formatSelect.value.split('/')[1];
        if (extension === 'jpeg') extension = 'jpg';

        // Get original filename without extension
        let originalName = 'image';
        if (originalFile && originalFile.name) {
            const lastDot = originalFile.name.lastIndexOf('.');
            originalName = lastDot !== -1 ? originalFile.name.substring(0, lastDot) : originalFile.name;
        }

        const newFileName = `${originalName}_converted.${extension}`;

        try {
            // Gunakan File System Access API agar muncul dialog "Save As" (pilih folder & nama)
            if (window.showSaveFilePicker) {
                const options = {
                    suggestedName: newFileName,
                    types: [{
                        description: 'Image file',
                        accept: {
                            [formatSelect.value]: [`.${extension}`],
                        },
                    }],
                };

                // Minta user memilih tempat penyimpanan
                const handle = await window.showSaveFilePicker(options);
                const writable = await handle.createWritable();
                await writable.write(convertedBlob);
                await writable.close();
                // Jika sukses menyimpan melalui dialog, fungsi selesai
                return;
            }
        } catch (err) {
            // Jika user klik "Cancel" di dialog save, batalkan
            if (err.name === 'AbortError') return;
            console.error('File Picker API error:', err);
        }

        // Fallback untuk browser yang belum mendukung fitur Save As (mungkin Firefox atau sistem keamanan tertentu)
        const downloadLink = document.createElement('a');
        downloadLink.href = currentObjectUrl;
        downloadLink.download = newFileName;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Show notification to user that the file is downloading as fallback
        alert(`Gambar telah otomatis diunduh ke folder "Downloads" dengan nama:\n${newFileName}`);
    }

    function resetWorkspace() {
        // Clear state
        currentImage = null;
        originalFile = null;
        convertedBlob = null;

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        previewImage.src = '';
        fileInput.value = '';

        // Reset UI
        uploadArea.classList.remove('hidden');
        workspace.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Image';

        // Reset selectors
        formatSelect.value = 'image/jpeg';
        qualitySlider.value = 80;
        qualityValue.textContent = '80%';
        qualityGroup.classList.remove('hidden');
    }

    function hideDownloadBtn() {
        downloadBtn.classList.add('hidden');
        convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Image';
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
