import { getDocument } from './js/pdf.mjs';

// Initialization
const profileText = document.getElementById('profile-text');
const pdfFrame = document.querySelector('.pdf-frame');

if (profileText) {
	fetch('assets/profile-para.txt')
		.then(function (response) {
			return response.text();
		})
		.then(function (text) {
			profileText.textContent = text;
		});
}

if (pdfFrame) {
	const pdfUrl = 'pdfs/project-covers.pdf';
	const slideDuration = 2000;

	pdfFrame.src = pdfUrl + '#page=1';

	getDocument(pdfUrl).promise
		.then(function (pdf) {
			const totalPages = pdf.numPages;

			if (totalPages <= 1) {
				return;
			}

			let currentPage = 1;

			const slideTimer = window.setInterval(function () {
				if (currentPage < totalPages) {
					currentPage += 1;
					pdfFrame.src = pdfUrl + '#page=' + currentPage;
					return;
				}

				pdfFrame.src = pdfUrl + '#page=1';
				window.clearInterval(slideTimer);
			}, slideDuration);
		})
		.catch(function () {
			pdfFrame.src = pdfUrl;
		});
}