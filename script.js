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



