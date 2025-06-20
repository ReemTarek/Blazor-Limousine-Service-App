// Bootstrap handles mobile navigation automatically, so we only need form-specific JavaScript

document.addEventListener('DOMContentLoaded', function () {

  
    // Handle driver registration form
    const driverForm = document.getElementById('driverRegistrationForm');
    const vehicleOwnershipInputs = document.querySelectorAll('input[name="vehicleOwnership"]');
    const vehicleDetailsSection = document.getElementById('vehicleDetails');
    const rentalPreferencesSection = document.getElementById('rentalPreferences');

    // Show/hide vehicle sections based on ownership selection
    vehicleOwnershipInputs.forEach(input => {
        input.addEventListener('change', function () {
            if (this.value === 'own') {
                if (vehicleDetailsSection) {
                    vehicleDetailsSection.style.display = 'block';
                    // Make vehicle fields required
                    const vehicleFields = vehicleDetailsSection.querySelectorAll('input[required], select[required]');
                    vehicleFields.forEach(field => field.required = true);
                }
                if (rentalPreferencesSection) {
                    rentalPreferencesSection.style.display = 'none';
                    // Remove required from rental fields
                    const rentalFields = rentalPreferencesSection.querySelectorAll('input[required], select[required]');
                    rentalFields.forEach(field => field.required = false);
                }
            } else if (this.value === 'rent') {
                if (vehicleDetailsSection) {
                    vehicleDetailsSection.style.display = 'none';
                    // Remove required from vehicle fields
                    const vehicleFields = vehicleDetailsSection.querySelectorAll('input[required], select[required]');
                    vehicleFields.forEach(field => field.required = false);
                }
                if (rentalPreferencesSection) {
                    rentalPreferencesSection.style.display = 'block';
                    // Make rental fields required
                    const rentalFields = rentalPreferencesSection.querySelectorAll('input[required], select[required]');
                    rentalFields.forEach(field => field.required = true);
                }
            }
        });
    });

    // Handle driver registration form submission
    if (driverForm) {
        driverForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Basic validation
            const requiredFields = this.querySelectorAll('[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.classList.add('is-invalid');
                    isValid = false;
                } else {
                    field.classList.remove('is-invalid');
                }
            });

            if (isValid) {
                // Show success message
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
                alertDiv.innerHTML = `
                    <strong>Success!</strong> Your driver registration has been submitted successfully.
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                this.appendChild(alertDiv);

                // Reset form after short delay
                setTimeout(() => {
                    this.reset();
                    if (vehicleDetailsSection) vehicleDetailsSection.style.display = 'none';
                    if (rentalPreferencesSection) rentalPreferencesSection.style.display = 'none';
                }, 2000);
            }
        });
    }

    // Set minimum date to today for date inputs
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
        input.min = today;
    });
});
