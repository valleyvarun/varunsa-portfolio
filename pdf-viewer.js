import { getDocument, GlobalWorkerOptions } from './js/pdf.mjs';

// PDF Setup
GlobalWorkerOptions.workerSrc = './js/pdf.worker.mjs';

const pdfUrl = 'pdfs/project-covers.pdf';
const pdfAspectRatio = 16 / 9;
const slideshowDelay = 4000;

// Viewer Elements
const prevButton = document.getElementById('pdf-prev');
const nextButton = document.getElementById('pdf-next');
const fullscreenButton = document.getElementById('pdf-fullscreen');
const pageNum = document.getElementById('pdf-page-num');
const pageCount = document.getElementById('pdf-page-count');
const viewerBody = document.getElementById('pdf-viewer-body');
const canvas = document.getElementById('pdf-canvas');

const popup = document.getElementById('pdf-popup');
const popupPrevButton = document.getElementById('pdf-popup-prev');
const popupNextButton = document.getElementById('pdf-popup-next');
const popupCloseButton = document.getElementById('pdf-popup-close');
const popupPageNum = document.getElementById('pdf-popup-page-num');
const popupPageCount = document.getElementById('pdf-popup-page-count');
const popupBody = document.getElementById('pdf-popup-body');
const popupCanvas = document.getElementById('pdf-popup-canvas');

// Viewer State
let pdfDocument = null;
let currentPage = 1;
let renderRequestId = 0;
let slideshowTimeoutId = null;
let slideshowPagesRemaining = 0;

// Slideshow
function clearSlideshowTimer() {
	if (slideshowTimeoutId !== null) {
		window.clearTimeout(slideshowTimeoutId);
		slideshowTimeoutId = null;
	}
}

function runSlideshowStep() {
	clearSlideshowTimer();

	if (!pdfDocument || slideshowPagesRemaining <= 0 || currentPage >= pdfDocument.numPages) {
		return;
	}

	slideshowTimeoutId = window.setTimeout(function () {
		currentPage += 1;
		slideshowPagesRemaining -= 1;
		renderPage();
		runSlideshowStep();
	}, slideshowDelay);
}

function startSlideshow() {
	if (!pdfDocument || pdfDocument.numPages <= 1) {
		return;
	}

	clearSlideshowTimer();
	currentPage = 1;
	slideshowPagesRemaining = pdfDocument.numPages - 1;
	renderPage();
	runSlideshowStep();
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
function scheduleRender() {
	renderRequestId += 1;
	const requestId = renderRequestId;

	window.requestAnimationFrame(function () {
		if (requestId !== renderRequestId) {
			return;
		}

		renderPage();
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
function updatePageInfo() {
	if (!pdfDocument) {
		return;
	}

	pageNum.textContent = String(currentPage);
	pageCount.textContent = String(pdfDocument.numPages);
	popupPageNum.textContent = String(currentPage);
	popupPageCount.textContent = String(pdfDocument.numPages);
}

function renderPage() {
	if (!pdfDocument) {
		return;
	}

	const inlineReady = updateViewerBodySize(viewerBody);
	const popupReady = !popup.classList.contains('is-open') || updateViewerBodySize(popupBody);

	if (!inlineReady || !popupReady) {
		scheduleRender();
		return;
	}

	pdfDocument.getPage(currentPage).then(function (page) {
		renderToCanvas(page, canvas, viewerBody);

		if (popup.classList.contains('is-open')) {
			renderToCanvas(page, popupCanvas, popupBody);
		}

		updatePageInfo();
	});
}

// Viewer Controls
function showPreviousPage() {
	if (!pdfDocument) {
		return;
	}

	clearSlideshowTimer();
	slideshowPagesRemaining = 0;
	if (currentPage <= 1) {
		currentPage = pdfDocument.numPages;
	} else {
		currentPage -= 1;
	}
	renderPage();
}

function showNextPage() {
	if (!pdfDocument) {
		return;
	}

	clearSlideshowTimer();
	slideshowPagesRemaining = 0;
	if (currentPage >= pdfDocument.numPages) {
		currentPage = 1;
	} else {
		currentPage += 1;
	}
	renderPage();
}

// Popup Controls
function openPopup() {
	popup.classList.add('is-open');
	popup.setAttribute('aria-hidden', 'false');
	scheduleRender();
}

function closePopup() {
	popup.classList.remove('is-open');
	popup.setAttribute('aria-hidden', 'true');

	const popupHeader = popup.querySelector('.pdf-viewer-header');

	if (popupHeader) {
		popupHeader.style.width = '';
	}
}

// Startup
if (prevButton && nextButton && fullscreenButton && canvas && viewerBody && popup && popupCanvas && popupBody) {
	prevButton.addEventListener('click', showPreviousPage);
	nextButton.addEventListener('click', showNextPage);
	fullscreenButton.addEventListener('click', openPopup);

	popupPrevButton.addEventListener('click', showPreviousPage);
	popupNextButton.addEventListener('click', showNextPage);
	popupCloseButton.addEventListener('click', closePopup);

	window.addEventListener('resize', function () {
		scheduleRender();
	});

	getDocument({ url: pdfUrl, disableWorker: true }).promise.then(function (pdf) {
		pdfDocument = pdf;
		startSlideshow();
	});
}
