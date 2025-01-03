// JavaScript to handle sidebar toggle
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');



// Add click event listener to the hamburger button
hamburger.addEventListener('click', () => {
    // Toggle the 'show' class on the sidebar
    sidebar.classList.toggle('show');
});



// JavaScript to load and display the paragraph text
fetch('assets/profile-para.txt') // Fetch the file
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text(); // Convert the response to text
    })
    .then(data => {
        document.getElementById('profile-paragraph').innerText = data; // Insert text into the <p> element
    })
    .catch(error => {
        console.error('Error fetching the file:', error);
    });





    
// download pdf file //

    // Add event listener to the download button
document.getElementById('download-pdf').addEventListener('click', () => {
    // Create a link element
    const link = document.createElement('a');
    
    // Set the href to the PDF file URL
    link.href = url; // The `url` variable already points to the PDF file
    
    // Set the download attribute to suggest a file name
    link.download = 'portfolio.pdf'; // Change 'portfolio.pdf' to your desired file name
    
    // Programmatically click the link to trigger the download
    link.click();
});

