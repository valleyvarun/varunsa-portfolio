import { getDocument, GlobalWorkerOptions } from '../js/pdf.mjs';

GlobalWorkerOptions.workerSrc = '../js/pdf.worker.mjs';

const pdfAspectRatio = 16 / 9;
const pdfUrls = [
	'../pdfs/archi-thesis/split1.pdf',
	'../pdfs/archi-thesis/split2.pdf',
	'../pdfs/archi-thesis/split3.pdf',
	'../pdfs/archi-thesis/split4.pdf',
	'../pdfs/archi-thesis/split5.pdf',
	'../pdfs/archi-thesis/split6.pdf'
];

const root = document.querySelector('[data-pdf-viewer]');
const prevButton = root.querySelector('[data-role="prev"]');
const nextButton = root.querySelector('[data-role="next"]');
const pageNumEl = root.querySelector('[data-role="page-num"]');
const pageCountEl = root.querySelector('[data-role="page-count"]');
const viewerBody = root.querySelector('[data-role="viewer-body"]');
const canvas = root.querySelector('[data-role="canvas"]');

const pageMap = [];
let currentIndex = 0;
let renderRequestId = 0;

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

function updateViewerBodySize() {
	const parent = viewerBody.parentElement;

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

	viewerBody.style.width = Math.floor(width) + 'px';
	viewerBody.style.height = Math.floor(height) + 'px';

	if (header) {
		header.style.width = Math.floor(width) + 'px';
	}

	return true;
}

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

function renderPage() {
	if (pageMap.length === 0) {
		return;
	}

	const ready = updateViewerBodySize();

	if (!ready) {
		scheduleRender();
		return;
	}

	const entry = pageMap[currentIndex];

	entry.doc.getPage(entry.pageNum).then(function (page) {
		const baseViewport = page.getViewport({ scale: 1 });
		const widthScale = viewerBody.clientWidth / baseViewport.width;
		const heightScale = viewerBody.clientHeight / baseViewport.height;
		const scale = Math.min(widthScale, heightScale);
		const viewport = page.getViewport({ scale: scale });
		const devicePixelRatio = window.devicePixelRatio || 1;
		const context = canvas.getContext('2d');

		canvas.width = Math.floor(viewport.width * devicePixelRatio);
		canvas.height = Math.floor(viewport.height * devicePixelRatio);
		canvas.style.width = viewport.width + 'px';
		canvas.style.height = viewport.height + 'px';

		page.render({
			canvasContext: context,
			viewport: viewport,
			transform: devicePixelRatio === 1 ? null : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
		});

		pageNumEl.textContent = String(currentIndex + 1);
		pageCountEl.textContent = String(pageMap.length);
	});
}

function showPreviousPage() {
	if (pageMap.length === 0) {
		return;
	}

	currentIndex = (currentIndex - 1 + pageMap.length) % pageMap.length;
	renderPage();
}

function showNextPage() {
	if (pageMap.length === 0) {
		return;
	}

	currentIndex = (currentIndex + 1) % pageMap.length;
	renderPage();
}

prevButton.addEventListener('click', showPreviousPage);
nextButton.addEventListener('click', showNextPage);

window.addEventListener('resize', function () {
	if (pageMap.length > 0) {
		scheduleRender();
	}
});

window.addEventListener('keydown', function (event) {
	if (event.key === 'ArrowLeft') {
		showPreviousPage();
	} else if (event.key === 'ArrowRight') {
		showNextPage();
	}
});

Promise.all(
	pdfUrls.map(function (url) {
		return getDocument({ url: url, disableWorker: true }).promise;
	})
).then(function (docs) {
	docs.forEach(function (doc) {
		for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
			pageMap.push({ doc: doc, pageNum: pageNumber });
		}
	});

	currentIndex = 0;
	pageCountEl.textContent = String(pageMap.length);
	renderPage();
});
