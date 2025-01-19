
import { getDocument, GlobalWorkerOptions } from '../js/pdf.mjs';

// Specify the worker script
GlobalWorkerOptions.workerSrc = '../js/pdf.worker.mjs';

// Show loading indicator
const loadingIndicator = document.getElementById('loading-indicator');
loadingIndicator.style.display = 'block';


//which pdf file to load based on the page
let url;

if (window.location.pathname.includes('index.html')) {
  url = 'pdfs/project-covers.pdf';
} else if (window.location.pathname.includes('portfolio.html')) {
  url = '../pdfs/portfolio.pdf';
} else if (window.location.pathname.includes('internship.html')) {
  url = '../pdfs/internship.pdf';
} else {
  // Default PDF file or handle other pages
  url = 'pdfs/project-covers.pdf'; 
}

// download pdf file //

// Add event listener to the download button
document.getElementById('download-pdf').addEventListener('click', () => {
  // Create a link element
  const link = document.createElement('a');
  
  // Determine the PDF file URL based on the current page
  if (window.location.pathname.includes('index.html')) {
    link.href = 'pdfs/project-covers.pdf';
    link.download = 'project-covers.pdf';
  } else if (window.location.pathname.includes('portfolio.html')) {
    link.href = '../pdfs/portfolio.pdf';
    link.download = 'portfolio.pdf';
  } else if (window.location.pathname.includes('internship.html')) {
    link.href = '../pdfs/internship.pdf';
    link.download = 'internship.pdf';
  } else {
    // Default PDF file
    link.href = 'pdfs/project-covers.pdf';
    link.download = 'project-covers.pdf';
  }
  
  // Trigger the download
  link.click();
});


document.addEventListener('DOMContentLoaded', () => {
  let container;

  if (window.location.pathname.includes('index.html')) {
    container = document.querySelector('.pdf-viewer-box');
  } else if (window.location.pathname.includes('portfolio.html')) {
    container = document.querySelector('.portfolio-container');
  }

  if (container) {
    const updateHeight = () => {
      const width = container.offsetWidth;
      const height = width * (9 / 16);
      container.style.setProperty('--calculated-height', `${height}px`);
    };

    // Initial height calculation
    updateHeight();

    // Update height on window resize
    window.addEventListener('resize', updateHeight);
  }
});



let pdfDoc = null,
  pageNum = 1,
  pageIsRendering = false,
  pageNumIsPending = null;

const scale = 1,
  canvas = document.querySelector('#pdf-render'),
  ctx = canvas.getContext('2d');

// Render the page
const renderPage = num => {
  pageIsRendering = true;

  // Get page
  pdfDoc.getPage(num).then(page => {
    // Set scale
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderCtx = {
      canvasContext: ctx,
      viewport
    };

    page.render(renderCtx).promise.then(() => {
      pageIsRendering = false;

      if (pageNumIsPending !== null) {
        renderPage(pageNumIsPending);
        pageNumIsPending = null;
      }
    });

    // Output current page
    document.querySelector('#page-num').textContent = num;
  });
};

// Check for pages rendering
const queueRenderPage = num => {
  if (pageIsRendering) {
    pageNumIsPending = num;
  } else {
    renderPage(num);
  }
};

// Show Prev Page
const showPrevPage = () => {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
};

// Show Next Page
const showNextPage = () => {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
};

// Get Document
pdfjsLib.getDocument(url).promise.then(pdfDoc_ => {
    pdfDoc = pdfDoc_;

    document.querySelector('#page-count').textContent = pdfDoc.numPages;

    renderPage(pageNum);
  })
  .catch(err => {
    // Display error
    const div = document.createElement('div');
    div.className = 'error';
    div.appendChild(document.createTextNode(err.message));
    document.querySelector('body').insertBefore(div, canvas);
    // Remove top bar
    document.querySelector('.top-bar').style.display = 'none';
  });

// Button Events
document.querySelector('#prev-page').addEventListener('click', showPrevPage);
document.querySelector('#next-page').addEventListener('click', showNextPage);


// Load the PDF
getDocument(url).promise.then(pdfDoc_ => {
  pdfDoc = pdfDoc_;
  loadingIndicator.style.display = 'none'; // Hide loading indicator
});
