// Initialization
const profileText = document.getElementById('profile-text');
const pdfThumbnailItems = document.querySelectorAll('.grid-item-child-pdf');
const browserPdfPopup = document.getElementById('browser-pdf-popup');
const browserPdfFrame = document.getElementById('browser-pdf-frame');
const browserPdfTitle = document.getElementById('browser-pdf-title');
const browserPdfClose = document.getElementById('browser-pdf-close');

if (profileText) {
	fetch('assets/profile-para.txt')
		.then(function (response) {
			return response.text();
		})
		.then(function (text) {
			profileText.textContent = text;
		});
}

function openBrowserPdfPopup(pdfUrl, pdfTitle) {
	if (!browserPdfPopup || !browserPdfFrame || !browserPdfTitle) {
		return;
	}

	browserPdfFrame.src = pdfUrl;
	browserPdfTitle.textContent = pdfTitle;
	browserPdfPopup.classList.add('is-open');
	browserPdfPopup.setAttribute('aria-hidden', 'false');
}

function closeBrowserPdfPopup() {
	if (!browserPdfPopup || !browserPdfFrame) {
		return;
	}

	browserPdfPopup.classList.remove('is-open');
	browserPdfPopup.setAttribute('aria-hidden', 'true');
	browserPdfFrame.src = '';
}

pdfThumbnailItems.forEach(function (item) {
	item.addEventListener('click', function () {
		openBrowserPdfPopup(item.dataset.pdf, item.dataset.pdfTitle || 'PDF Preview');
	});

	item.addEventListener('keydown', function (event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openBrowserPdfPopup(item.dataset.pdf, item.dataset.pdfTitle || 'PDF Preview');
		}
	});
});

if (browserPdfClose) {
	browserPdfClose.addEventListener('click', closeBrowserPdfPopup);
}

if (browserPdfPopup) {
	browserPdfPopup.addEventListener('click', function (event) {
		if (event.target === browserPdfPopup) {
			closeBrowserPdfPopup();
		}
	});
}
