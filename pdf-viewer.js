import { getDocument, GlobalWorkerOptions } from './js/pdf.mjs';

// PDF Setup
GlobalWorkerOptions.workerSrc = './js/pdf.worker.mjs';

const pdfAspectRatio = 16 / 9;
const slideshowDelay = 4000;
const mobileInlineViewerWidthRatio = 0.9;
const pdfDocumentCache = new Map();

// Viewer Elements
const viewerRoots = document.querySelectorAll('[data-pdf-viewer]');

const popup = document.getElementById('pdf-popup');
const popupPrevButton = document.getElementById('pdf-popup-prev');
const popupNextButton = document.getElementById('pdf-popup-next');
const popupCloseButton = document.getElementById('pdf-popup-close');
const popupPageNum = document.getElementById('pdf-popup-page-num');
const popupPageCount = document.getElementById('pdf-popup-page-count');
const popupBody = document.getElementById('pdf-popup-body');
const popupCanvas = document.getElementById('pdf-popup-canvas');

// Viewer State
let activePopupViewer = null;
let autoplaySequenceCancelled = false;

function createViewerState(root) {
	return {
		root: root,
		pdfUrl: root.dataset.pdfUrl || '',
		autoplay: root.dataset.slideshow === 'true',
		autoplayOrder: Number(root.dataset.slideshowOrder || Number.MAX_SAFE_INTEGER),
		prevButton: root.querySelector('[data-role="prev"]'),
		nextButton: root.querySelector('[data-role="next"]'),
		fullscreenButton: root.querySelector('[data-role="fullscreen"]'),
		pageNum: root.querySelector('[data-role="page-num"]'),
		pageCount: root.querySelector('[data-role="page-count"]'),
		viewerBody: root.querySelector('[data-role="viewer-body"]'),
		canvas: root.querySelector('[data-role="canvas"]'),
		pdfDocument: null,
		currentPage: 1,
		renderRequestId: 0,
		slideshowTimeoutId: null,
		slideshowPagesRemaining: 0
	};
}

const viewers = Array.from(viewerRoots).map(createViewerState);

function stopAutoplaySequence() {
	autoplaySequenceCancelled = true;
	viewers.forEach(function (viewer) {
		clearSlideshowTimer(viewer);
		viewer.slideshowPagesRemaining = 0;
	});
}

function continueAutoplaySequenceAfter(viewer) {
	stopAutoplaySequence();
	viewer.autoplay = false;

	window.setTimeout(function () {
		autoplaySequenceCancelled = false;
		startAutoplaySequence(viewer.autoplayOrder + 1);
	}, 0);
}

// Slideshow
function clearSlideshowTimer(viewer) {
	if (viewer.slideshowTimeoutId !== null) {
		window.clearTimeout(viewer.slideshowTimeoutId);
		viewer.slideshowTimeoutId = null;
	}
}

function runSlideshowStep(viewer, onComplete) {
	clearSlideshowTimer(viewer);

	if (!viewer.pdfDocument || viewer.slideshowPagesRemaining <= 0 || viewer.currentPage >= viewer.pdfDocument.numPages) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	viewer.slideshowTimeoutId = window.setTimeout(function () {
		if (autoplaySequenceCancelled) {
			clearSlideshowTimer(viewer);
			viewer.slideshowPagesRemaining = 0;
			return;
		}

		viewer.currentPage += 1;
		viewer.slideshowPagesRemaining -= 1;
		renderPage(viewer);
		runSlideshowStep(viewer, onComplete);
	}, slideshowDelay);
}

function startSlideshow(viewer) {
	return new Promise(function (resolve) {
		if (!viewer.autoplay || !viewer.pdfDocument || viewer.pdfDocument.numPages <= 1 || autoplaySequenceCancelled) {
			resolve();
			return;
		}

		clearSlideshowTimer(viewer);
		viewer.currentPage = 1;
		viewer.slideshowPagesRemaining = viewer.pdfDocument.numPages - 1;
		renderPage(viewer);
		runSlideshowStep(viewer, resolve);
	});
	}

function startAutoplaySequence(minOrder) {
	const minimumOrder = typeof minOrder === 'number' ? minOrder : Number.NEGATIVE_INFINITY;
	const autoplayViewers = viewers
		.filter(function (viewer) {
			return viewer.autoplay && viewer.pdfDocument && viewer.autoplayOrder >= minimumOrder;
		})
		.sort(function (left, right) {
			return left.autoplayOrder - right.autoplayOrder;
		});

	let sequence = Promise.resolve();

	autoplayViewers.forEach(function (viewer) {
		sequence = sequence.then(function () {
			if (autoplaySequenceCancelled) {
				return Promise.resolve();
			}

			return startSlideshow(viewer);
		});
	});

	return sequence;
	}

// Layout Helpers
function getGapSize(element) {
	const styles = window.getComputedStyle(element);
	const rowGap = parseFloat(styles.rowGap);
	const gap = parseFloat(styles.gap);

	if (!Number.isNaN(rowGap)) {
		return rowGap;
	}

	if (!Number.isNaN(gap)) {
		return gap;
	}

	return 0;
}

function updateViewerBodySize(container) {
	const parent = container.parentElement;

	if (!parent) {
		return false;
	}

	const header = parent.querySelector('.pdf-viewer-header');
	const availableWidth = parent.clientWidth;
	const availableHeight = parent.clientHeight - (header ? header.offsetHeight : 0) - getGapSize(parent);

	if (availableWidth <= 0 || availableHeight <= 0) {
		return false;
	}

	let width = Math.min(availableWidth, availableHeight * pdfAspectRatio);
	let height = width / pdfAspectRatio;

	if (container !== popupBody && window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches) {
		const mobileTargetWidth = Math.min(availableWidth, window.innerWidth * mobileInlineViewerWidthRatio);
		const mobileTargetHeight = mobileTargetWidth / pdfAspectRatio;

		if (mobileTargetHeight <= availableHeight) {
			width = mobileTargetWidth;
			height = mobileTargetHeight;
		}
	}

	if (height > availableHeight) {
		height = availableHeight;
		width = height * pdfAspectRatio;
	}

	container.style.width = Math.floor(width) + 'px';
	container.style.height = Math.floor(height) + 'px';

	if (parent.classList.contains('pdf-popup-panel') && header) {
		header.style.width = Math.floor(width) + 'px';
	}

	return true;
}

// Render Helpers
function scheduleRender(viewer) {
	viewer.renderRequestId += 1;
	const requestId = viewer.renderRequestId;

	window.requestAnimationFrame(function () {
		if (requestId !== viewer.renderRequestId) {
			return;
		}

		renderPage(viewer);
	});
}

function getScale(page, container) {
	const viewport = page.getViewport({ scale: 1 });
	const widthScale = container.clientWidth / viewport.width;
	const heightScale = container.clientHeight / viewport.height;
	return Math.min(widthScale, heightScale);
}

function renderToCanvas(page, targetCanvas, container) {
	const scale = getScale(page, container);
	const viewport = page.getViewport({ scale: scale });
	const devicePixelRatio = window.devicePixelRatio || 1;
	const context = targetCanvas.getContext('2d');

	targetCanvas.width = Math.floor(viewport.width * devicePixelRatio);
	targetCanvas.height = Math.floor(viewport.height * devicePixelRatio);
	targetCanvas.style.width = viewport.width + 'px';
	targetCanvas.style.height = viewport.height + 'px';

	page.render({
		canvasContext: context,
		viewport: viewport,
		transform: devicePixelRatio === 1 ? null : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
	});
}

// Page Rendering
function updatePageInfo(viewer) {
	if (!viewer.pdfDocument || !viewer.pageNum || !viewer.pageCount) {
		return;
	}

	viewer.pageNum.textContent = String(viewer.currentPage);
	viewer.pageCount.textContent = String(viewer.pdfDocument.numPages);

	if (activePopupViewer === viewer) {
		popupPageNum.textContent = String(viewer.currentPage);
		popupPageCount.textContent = String(viewer.pdfDocument.numPages);
	}
}

function renderPage(viewer) {
	if (!viewer.pdfDocument || !viewer.viewerBody || !viewer.canvas) {
		return;
	}

	const inlineReady = updateViewerBodySize(viewer.viewerBody);
	const popupReady = activePopupViewer !== viewer || !popup.classList.contains('is-open') || updateViewerBodySize(popupBody);

	if (!inlineReady || !popupReady) {
		scheduleRender(viewer);
		return;
	}

	viewer.pdfDocument.getPage(viewer.currentPage).then(function (page) {
		renderToCanvas(page, viewer.canvas, viewer.viewerBody);

		if (activePopupViewer === viewer && popup.classList.contains('is-open')) {
			renderToCanvas(page, popupCanvas, popupBody);
		}

		updatePageInfo(viewer);
	});
}

// Viewer Controls
function showPreviousPage(viewer) {
	if (!viewer.pdfDocument) {
		return;
	}

	continueAutoplaySequenceAfter(viewer);
	if (viewer.currentPage <= 1) {
		viewer.currentPage = viewer.pdfDocument.numPages;
	} else {
		viewer.currentPage -= 1;
	}
	renderPage(viewer);
}

function showNextPage(viewer) {
	if (!viewer.pdfDocument) {
		return;
	}

	continueAutoplaySequenceAfter(viewer);
	if (viewer.currentPage >= viewer.pdfDocument.numPages) {
		viewer.currentPage = 1;
	} else {
		viewer.currentPage += 1;
	}
	renderPage(viewer);
}

// Popup Controls
function openPopup(viewer) {
	activePopupViewer = viewer;
	popup.classList.add('is-open');
	popup.setAttribute('aria-hidden', 'false');
	scheduleRender(viewer);
}

function closePopup() {
	popup.classList.remove('is-open');
	popup.setAttribute('aria-hidden', 'true');
	activePopupViewer = null;

	const popupHeader = popup.querySelector('.pdf-viewer-header');

	if (popupHeader) {
		popupHeader.style.width = '';
	}
}

// PDF Loading
function loadPdfDocument(pdfUrl) {
	if (!pdfDocumentCache.has(pdfUrl)) {
		pdfDocumentCache.set(pdfUrl, getDocument({ url: pdfUrl, disableWorker: true }).promise);
	}

	return pdfDocumentCache.get(pdfUrl);
}

// Startup
if (viewers.length > 0 && popup && popupCanvas && popupBody) {
	viewers.forEach(function (viewer) {
		if (!viewer.prevButton || !viewer.nextButton || !viewer.fullscreenButton || !viewer.viewerBody || !viewer.canvas || !viewer.pdfUrl) {
			return;
		}

		viewer.prevButton.addEventListener('click', function () {
			showPreviousPage(viewer);
		});

		viewer.nextButton.addEventListener('click', function () {
			showNextPage(viewer);
		});

		viewer.fullscreenButton.addEventListener('click', function () {
			openPopup(viewer);
		});
	});

	Promise.all(
		viewers.map(function (viewer) {
			if (!viewer.pdfUrl) {
				return Promise.resolve();
			}

			return loadPdfDocument(viewer.pdfUrl).then(function (pdf) {
				viewer.pdfDocument = pdf;
				viewer.currentPage = 1;
				renderPage(viewer);
			});
		})
	).then(function () {
		startAutoplaySequence();
	});

	popupPrevButton.addEventListener('click', function () {
		if (activePopupViewer) {
			showPreviousPage(activePopupViewer);
		}
	});

	popupNextButton.addEventListener('click', function () {
		if (activePopupViewer) {
			showNextPage(activePopupViewer);
		}
	});

	popupCloseButton.addEventListener('click', closePopup);

	window.addEventListener('resize', function () {
		viewers.forEach(function (viewer) {
			if (viewer.pdfDocument) {
				scheduleRender(viewer);
			}
		});
	});
}
