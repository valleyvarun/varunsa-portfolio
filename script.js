// Centralized script: sidebar toggle (if present), loader control, and iframe auto-resize

// pdf.js powered viewer and shared UI logic
import { getDocument, GlobalWorkerOptions } from './js/pdf.mjs';

(function () {
    function onReady(fn) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(fn, 0);
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }

    onReady(function () {
        // Sidebar toggle (guarded if elements don't exist on this page)
        var hamburger = document.getElementById('hamburger');
        var sidebar = document.getElementById('sidebar');
        if (hamburger && sidebar) {
            hamburger.addEventListener('click', function () {
                sidebar.classList.toggle('show');
            });
        }

            // Loading indicator helpers
            function showLoader() {
                var el = document.getElementById('loading-indicator');
                if (el) el.style.display = 'block';
            }
            function hideLoader() {
                var el = document.getElementById('loading-indicator');
                if (el) el.style.display = 'none';
            }
            // Track when both the page and the embedded TXT are loaded
            var loadState = { window: false, profile: false };
            function attemptHide() {
                if (loadState.window && loadState.profile) hideLoader();
            }

                // Load profile text via fetch so the div grows naturally with content
                function loadProfileText() {
                    var target = document.getElementById('profile-text');
                    if (!target) { loadState.profile = true; attemptHide(); return; }
                    fetch('assets/profile-para.txt')
                        .then(function (resp) { return resp.text(); })
                        .then(function (text) {
                            // Preserve paragraphs: split on blank lines
                            var parts = text.trim().split(/\n\s*\n/);
                            target.innerHTML = parts.map(function(p){ return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
                            loadState.profile = true; attemptHide();
                        })
                        .catch(function(){ loadState.profile = true; attemptHide(); });
                }

        // Show loader immediately once DOM is ready
        showLoader();

        // Hook up events
                    // Kick off loading of profile text
                    loadProfileText();

            // When the whole page (images, styles, iframes, etc.) has finished loading
            window.addEventListener('load', function () {
                loadState.window = true;
                        attemptHide();
            });

                // ===== pdf.js viewer =====
                let currentUrl = 'pdfs/project-covers.pdf';
                const canvas = document.getElementById('pdf-canvas');
                const prevBtn = document.getElementById('pdf-prev');
                const nextBtn = document.getElementById('pdf-next');
                const fullscreenBtn = document.getElementById('pdf-fullscreen');
                const pageNumEl = document.getElementById('pdf-page-num');
                const pageCountEl = document.getElementById('pdf-page-count');
                const orientationHint = document.getElementById('orientation-hint');
                const pdfPane = document.querySelector('.pdf-pane');
                // Overlay viewer elements
                const overlay = document.getElementById('overlay-viewer');
                const ovCanvas = document.getElementById('ov-canvas');
                const ovPrev = document.getElementById('ov-prev');
                const ovNext = document.getElementById('ov-next');
                const ovClose = document.getElementById('ov-close');
                const ovPageNum = document.getElementById('ov-page-num');
                const ovPageCount = document.getElementById('ov-page-count');

                // Configure worker for pdf.js
                GlobalWorkerOptions.workerSrc = './js/pdf.worker.mjs';

                // In-column viewer state
                let pdfDoc = null;
                let pageNum = 1;
                let scale = 1.0;
                let rendering = false;
                let pendingPage = null;

                const AUTO_ADVANCE_DELAY = 4000;
                const MAX_AUTO_ADVANCE_LOOPS = 3;
                let autoAdvanceTimer = null;
                let autoAdvanceEnabled = true;
                let autoAdvanceLoopCount = 0;

                function clearAutoAdvanceTimer() {
                    if (autoAdvanceTimer) {
                        clearTimeout(autoAdvanceTimer);
                        autoAdvanceTimer = null;
                    }
                }

                function scheduleAutoAdvance() {
                    if (!autoAdvanceEnabled) return;
                    if (autoAdvanceLoopCount >= MAX_AUTO_ADVANCE_LOOPS) {
                        stopAutoAdvance();
                        return;
                    }
                    clearAutoAdvanceTimer();
                    if (!pdfDoc || pdfDoc.numPages <= 1) return;
                    autoAdvanceTimer = window.setTimeout(function () {
                        if (!autoAdvanceEnabled || !pdfDoc) return;
                        const nextPage = (pageNum % pdfDoc.numPages) + 1;
                        if (nextPage === 1) {
                            autoAdvanceLoopCount += 1;
                            if (autoAdvanceLoopCount >= MAX_AUTO_ADVANCE_LOOPS) {
                                stopAutoAdvance();
                                return;
                            }
                        }
                        pageNum = nextPage;
                        queueRenderPage(pageNum);
                    }, AUTO_ADVANCE_DELAY);
                }

                function stopAutoAdvance() {
                    autoAdvanceEnabled = false;
                    clearAutoAdvanceTimer();
                }

                function restartAutoAdvance() {
                    autoAdvanceEnabled = true;
                    autoAdvanceLoopCount = 0;
                    clearAutoAdvanceTimer();
                }

                function userStoppedAutoAdvance() {
                    if (!autoAdvanceEnabled) return;
                    stopAutoAdvance();
                }

                // Overlay viewer state
                let ovPdfDoc = null;
                let ovPage = 1;
                let ovScale = 1.0;
                let ovRendering = false;
                let ovPending = null;

                function fitWidthScale(viewportWidth, pageViewport) {
                    return viewportWidth / pageViewport.width;
                }

                    function renderPage(num, fitToWidth = false) {
                    rendering = true;
                    pdfDoc.getPage(num).then(function(page) {
                        // Use 1.0 initial viewport to compute scale properly
                        const unscaled = page.getViewport({ scale: 1.0 });
                        const container = canvas.parentElement; // .pdf-viewer-box
                        const targetWidth = container.clientWidth;
                        const targetHeight = container.clientHeight; // aspect-ratio enforces height
                        let targetScale = scale;
                        if (fitToWidth || !scale) {
                            targetScale = fitWidthScale(targetWidth, unscaled);
                        }
                        const viewport = page.getViewport({ scale: targetScale });

                        // If height exceeds the container (due to aspect-ratio), clamp scale
                        if (viewport.height > targetHeight) {
                            const heightScale = targetHeight / unscaled.height;
                            targetScale = Math.min(targetScale, heightScale);
                        }

                            const finalViewport = page.getViewport({ scale: targetScale });

                            // High-DPI rendering: adaptive DPR with safety caps
                            const MAX_DPR = 3; // allow up to 3x on capable devices
                            const MAX_CANVAS_PIXELS = 8294400; // ~8.3 MP (approx 4K), safety to avoid OOM
                            const cssW = Math.floor(finalViewport.width);
                            const cssH = Math.floor(finalViewport.height);
                            const deviceDpr = window.devicePixelRatio || 1;
                            const desiredDpr = Math.min(deviceDpr, MAX_DPR);
                            const maxByPixels = Math.sqrt(Math.max(1, MAX_CANVAS_PIXELS / Math.max(1, cssW * cssH)));
                            const dpr = Math.max(1, Math.min(desiredDpr, maxByPixels));
                            // Set CSS size (display size)
                            canvas.style.width = cssW + 'px';
                            canvas.style.height = cssH + 'px';
                            // Set actual pixel buffer size
                            canvas.width = Math.floor(cssW * dpr);
                            canvas.height = Math.floor(cssH * dpr);

                            const ctx = canvas.getContext('2d');
                            if (ctx && 'imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
                            const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;
                            const renderContext = { canvasContext: ctx, viewport: finalViewport, transform };
                        const renderTask = page.render(renderContext);

                        renderTask.promise.then(function() {
                            rendering = false;
                            scale = targetScale; // persist latest scale
                            if (pendingPage !== null) {
                                const p = pendingPage; pendingPage = null; renderPage(p);
                            } else if (autoAdvanceEnabled) {
                                scheduleAutoAdvance();
                            }
                        });
                        pageNumEl.textContent = num;
                    });
                }

                function queueRenderPage(num) {
                    if (rendering) {
                        pendingPage = num;
                    } else {
                        renderPage(num);
                    }
                }

                function onPrevPage() {
                    if (pageNum <= 1) return;
                    pageNum--; queueRenderPage(pageNum);
                }
                function onNextPage() {
                    if (pageNum >= pdfDoc.numPages) return;
                    pageNum++; queueRenderPage(pageNum);
                }
                    function isMobile() {
                        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                    }

                    function showOrientationHintTemporarily() {
                        if (!orientationHint) return;
                        orientationHint.style.display = 'block';
                        setTimeout(function() { orientationHint.style.display = 'none'; }, 2500);
                    }

                    function tryLockLandscape() {
                        // Orientation API works only in fullscreen in most browsers; we'll try as best-effort.
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape').catch(function() {
                                // Ignore errors; show hint instead.
                                showOrientationHintTemporarily();
                            });
                        } else {
                            showOrientationHintTemporarily();
                        }
                    }

                    function toggleFullscreen() {
                        const body = document.body;
                        const isMax = pdfPane && pdfPane.classList.contains('maximized');
                        const fsIcon = fullscreenBtn.querySelector('span');
                        if (!isMax) {
                            if (pdfPane) pdfPane.classList.add('maximized');
                            body.classList.add('no-scroll');
                            if (fsIcon) fsIcon.textContent = '▭'; // collapse icon
                            if (isMobile()) tryLockLandscape();
                        } else {
                            if (pdfPane) pdfPane.classList.remove('maximized');
                            body.classList.remove('no-scroll');
                            if (fsIcon) fsIcon.textContent = '⛶'; // expand icon
                        }
                        // Refit after layout change
                        setTimeout(function(){ renderPage(pageNum, true); }, 150);
                    }

                    if (canvas && prevBtn && nextBtn && fullscreenBtn && pageNumEl && pageCountEl) {
                    function loadPdf(urlToLoad) {
                        return getDocument(urlToLoad).promise.then(function(pdf) {
                            pdfDoc = pdf;
                            pageNum = 1;
                            scale = 1.0;
                            pageCountEl.textContent = pdf.numPages;
                            restartAutoAdvance();
                            renderPage(pageNum, true);
                        });
                    }

                    loadPdf(currentUrl);

                    // Note: thumbnails are handled by the separate overlay viewer below

                    prevBtn.addEventListener('click', function () {
                        userStoppedAutoAdvance();
                        onPrevPage();
                    });
                    nextBtn.addEventListener('click', function () {
                        userStoppedAutoAdvance();
                        onNextPage();
                    });
                    fullscreenBtn.addEventListener('click', function () {
                        userStoppedAutoAdvance();
                        toggleFullscreen();
                    });
                        // exitMaxBtn removed; we rely on the same button to toggle collapse/expand

                    // Re-fit on resize
                    window.addEventListener('resize', function() { renderPage(pageNum, true); });
                }

                // ===== Overlay viewer helpers =====
                function ovFitWidthScale(viewportWidth, pageViewport) {
                    return viewportWidth / pageViewport.width;
                }

                function ovRender(pageNo, fitToWidth = false) {
                    if (!ovPdfDoc) return;
                    ovRendering = true;
                    ovPdfDoc.getPage(pageNo).then(function(page){
                        const unscaled = page.getViewport({ scale: 1.0 });
                        const box = document.getElementById('ov-box');
                        const targetWidth = box.clientWidth;
                        const targetHeight = box.clientHeight;
                        let targetScale = ovScale;
                        if (fitToWidth || !ovScale) targetScale = ovFitWidthScale(targetWidth, unscaled);
                        let viewport = page.getViewport({ scale: targetScale });
                        if (viewport.height > targetHeight) {
                            const heightScale = targetHeight / unscaled.height;
                            targetScale = Math.min(targetScale, heightScale);
                            viewport = page.getViewport({ scale: targetScale });
                        }
                        const cssW = Math.floor(viewport.width);
                        const cssH = Math.floor(viewport.height);
                        const deviceDpr = window.devicePixelRatio || 1;
                        const MAX_DPR = 3;
                        const MAX_PIX = 8294400;
                        const desired = Math.min(deviceDpr, MAX_DPR);
                        const maxByPix = Math.sqrt(Math.max(1, MAX_PIX / Math.max(1, cssW * cssH)));
                        const dpr = Math.max(1, Math.min(desired, maxByPix));
                        ovCanvas.style.width = cssW + 'px';
                        ovCanvas.style.height = cssH + 'px';
                        ovCanvas.width = Math.floor(cssW * dpr);
                        ovCanvas.height = Math.floor(cssH * dpr);
                        const ctx = ovCanvas.getContext('2d');
                        if (ctx && 'imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
                        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;
                        const renderTask = page.render({ canvasContext: ctx, viewport, transform });
                        renderTask.promise.then(function(){
                            ovRendering = false;
                            ovScale = targetScale;
                            if (ovPending !== null) { const p = ovPending; ovPending = null; ovRender(p); }
                        });
                        ovPageNum.textContent = pageNo;
                    });
                }

                function ovQueue(pageNo) { if (ovRendering) ovPending = pageNo; else ovRender(pageNo); }

                function ovLoad(url) {
                    return getDocument(url).promise.then(function(pdf){
                        ovPdfDoc = pdf;
                        ovPage = 1;
                        ovPageCount.textContent = pdf.numPages;
                        ovRender(ovPage, true);
                    });
                }

                function ovPrevPage(){ if (ovPage <= 1) return; ovPage--; ovQueue(ovPage); }
                function ovNextPage(){ if (ovPage >= (ovPdfDoc ? ovPdfDoc.numPages : 0)) return; ovPage++; ovQueue(ovPage); }
                function ovCloseOverlay(){ if (overlay) overlay.classList.remove('show'); document.body.classList.remove('no-scroll'); }

                if (overlay && ovCanvas && ovPrev && ovNext && ovClose && ovPageNum && ovPageCount) {
                    ovPrev.addEventListener('click', ovPrevPage);
                    ovNext.addEventListener('click', ovNextPage);
                    ovClose.addEventListener('click', ovCloseOverlay);
                    window.addEventListener('resize', function(){ if (overlay.classList.contains('show')) ovRender(ovPage, true); });
                }

                // Wire thumbnails to open overlay viewer
                (function(){
                    const thumbs = document.querySelectorAll('.thumbs-grid .thumb[data-pdf]');
                    thumbs.forEach(function(thumb){
                        function openThumb(){
                            const target = thumb.getAttribute('data-pdf');
                            if (!target) return;
                            ovLoad(target).then(function(){
                                if (overlay) overlay.classList.add('show');
                                document.body.classList.add('no-scroll');
                            });
                        }
                        thumb.addEventListener('click', openThumb);
                        thumb.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThumb(); } });
                    });
                })();
    });
})();



