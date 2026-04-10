// Initialization
const profileText = document.getElementById('profile-text');
const textContentTargets = document.querySelectorAll('[data-text-src]');
const pdfThumbnailItems = document.querySelectorAll('.grid-item-child-pdf');
const browserPdfPopup = document.getElementById('browser-pdf-popup');
const browserPdfFrame = document.getElementById('browser-pdf-frame');
const browserPdfTitle = document.getElementById('browser-pdf-title');
const browserPdfClose = document.getElementById('browser-pdf-close');

function loadTextContent(target, url) {
	fetch(url)
		.then(function (response) {
			return response.text();
		})
		.then(function (text) {
			if (target.dataset.textFormat === 'paragraphs') {
				target.replaceChildren();

				text
					.split(/\r?\n\s*\r?\n|\r?\n/)
					.map(function (paragraph) {
						return paragraph.trim();
					})
					.filter(function (paragraph) {
						return paragraph.length > 0;
					})
					.forEach(function (paragraph) {
						const paragraphElement = document.createElement('p');
						paragraphElement.textContent = paragraph;
						target.appendChild(paragraphElement);
					});
				return;
			}

			target.textContent = text;
		});
}

if (profileText) {
	loadTextContent(profileText, 'assets/profile-para.txt');
}

textContentTargets.forEach(function (target) {
	if (target.dataset.textSrc) {
		loadTextContent(target, target.dataset.textSrc);
	}
});

if (profileText && profileText.dataset.textSrc) {
	loadTextContent(profileText, profileText.dataset.textSrc);
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
