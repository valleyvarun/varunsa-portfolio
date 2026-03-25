// Initialization
const profileText = document.getElementById('profile-text');

if (profileText) {
	fetch('assets/profile-para.txt')
		.then(function (response) {
			return response.text();
		})
		.then(function (text) {
			profileText.textContent = text;
		});
}
