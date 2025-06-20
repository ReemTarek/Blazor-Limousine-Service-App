let bookingMap;
let pickupMarker;
let destinationMarker;
let routeLine;
let dotNetRef;
let searchTimeout;
let selectedSuggestionIndex = -1;
//need test
// Route calculation configuration
const ROUTING_CONFIG = {
    // You'll need to get a free API key from https://openrouteservice.org/
    //test key
    API_KEY: '5b3ce3597851110001cf6248d0606398520f425499ec85c6f0e50dd4', // Replace with your actual API key
    BASE_URL: 'https://api.openrouteservice.org/v2/directions/driving-car',
    FALLBACK_TO_STRAIGHT_LINE: false,
    // Route optimization settings
    ROUTE_PREFERENCE: 'recommended',
    AVOID_HIGHWAYS: false,
    AVOID_TOLLS: false,
    VEHICLE_TYPE: 'driving-car',
    // Enhanced accuracy settings
    GEOMETRY_FORMAT: 'geojson', // More precise than polyline
    RADIUSES: 1000, // Allow 1km radius for snapping to roads
    CONTINUE_STRAIGHT: true,
    ROUNDABOUT_EXITS: true,
    DETAILED_INSTRUCTIONS: true
};

// Route cache to avoid repeated API calls
const routeCache = new Map();

// Initialize the booking map
window.initBookingMap = (dotNetReference) => {
    dotNetRef = dotNetReference;

    bookingMap = L.map('bookingMap').setView([40.7128, -74.0060], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(bookingMap);

    bookingMap.on('click', function (e) {
        setDestinationMarker(e.latlng.lat, e.latlng.lng);
    });
};

// Initialize autocomplete functionality
window.initAutocomplete = () => {
    setupInputEvents('pickupSearchInput', 'pickupSuggestions', 'pickup');
    setupInputEvents('destinationSearchInput', 'destinationSuggestions', 'destination');
};

// Setup input events for autocomplete
function setupInputEvents(inputId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);

    if (!input || !suggestions) return;

    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
        const suggestionItems = suggestions.querySelectorAll('.autocomplete-suggestion:not(.loading-suggestion)');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestionItems.length - 1);
                updateSelectedSuggestion(suggestions);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                updateSelectedSuggestion(suggestions);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestionItems.length) {
                    selectSuggestion(suggestionItems[selectedSuggestionIndex], type);
                }
                break;
            case 'Escape':
                hideSuggestions(type);
                break;
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            hideSuggestions(type);
        }
    });
}

// Update visual selection of suggestions
function updateSelectedSuggestion(suggestionsContainer) {
    const suggestions = suggestionsContainer.querySelectorAll('.autocomplete-suggestion:not(.loading-suggestion)');
    suggestions.forEach((suggestion, index) => {
        suggestion.classList.toggle('selected', index === selectedSuggestionIndex);
    });
}

// Search for locations using Nominatim
window.searchLocation = async (query, type) => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
        const suggestionsContainer = document.getElementById(type + 'Suggestions');
        if (!suggestionsContainer) return;

        // Show loading indicator
        showLoadingSuggestions(suggestionsContainer);

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
            );

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            showSuggestions(results, type, suggestionsContainer);
        } catch (error) {
            console.error('Geocoding error:', error);
            showErrorSuggestion(suggestionsContainer);
        }
    }, 300); // 300ms debounce
};

// Show loading indicator
function showLoadingSuggestions(container) {
    container.innerHTML = '<div class="loading-suggestion">🔍 Searching...</div>';
    container.style.display = 'block';
    selectedSuggestionIndex = -1;
}

// Show error message
function showErrorSuggestion(container) {
    container.innerHTML = '<div class="loading-suggestion">❌ Search failed. Please try again.</div>';
    container.style.display = 'block';
}

// Display search suggestions
function showSuggestions(results, type, container) {
    if (results.length === 0) {
        container.innerHTML = '<div class="loading-suggestion">No results found</div>';
        container.style.display = 'block';
        return;
    }

    const suggestionsHtml = results.map((result, index) => {
        const displayName = result.display_name;
        const shortName = formatDisplayName(displayName);

        return `<div class="autocomplete-suggestion" 
                     data-lat="${result.lat}" 
                     data-lng="${result.lon}" 
                     data-address="${displayName}"
                     data-index="${index}">
                    <strong>${shortName.main}</strong>
                    <br><small class="text-muted">${shortName.detail}</small>
                </div>`;
    }).join('');

    container.innerHTML = suggestionsHtml;
    container.style.display = 'block';
    selectedSuggestionIndex = -1;

    // Add click event listeners
    container.querySelectorAll('.autocomplete-suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', () => selectSuggestion(suggestion, type));
    });
}

// Format display name for better readability
function formatDisplayName(displayName) {
    const parts = displayName.split(',');
    const main = parts.slice(0, 2).join(',').trim();
    const detail = parts.length > 2 ? parts.slice(2).join(',').trim() : '';

    return {
        main: main.length > 50 ? main.substring(0, 50) + '...' : main,
        detail: detail.length > 60 ? detail.substring(0, 60) + '...' : detail
    };
}

// Select a suggestion
function selectSuggestion(suggestion, type) {
    const lat = parseFloat(suggestion.dataset.lat);
    const lng = parseFloat(suggestion.dataset.lng);
    const address = suggestion.dataset.address;

    // Update input field
    const input = document.getElementById(type + 'SearchInput');
    if (input) {
        input.value = address;
    }

    // Update map and markers
    if (type === 'pickup') {
        setPickupMarker(lat, lng, address);
    } else {
        setDestinationMarker(lat, lng, address);
    }

    // Hide suggestions
    hideSuggestions(type);
}

// Hide suggestions
window.hideSuggestions = (type) => {
    const container = document.getElementById(type + 'Suggestions');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
    selectedSuggestionIndex = -1;
};

// Get current location automatically on page load
window.getCurrentLocationOnLoad = () => {
    if (navigator.geolocation) {
        // Show a subtle loading indicator
        const pickupInput = document.getElementById('pickupSearchInput');
        if (pickupInput) {
            pickupInput.placeholder = '📍 Getting your location...';
            pickupInput.style.backgroundColor = '#f8f9fa';
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                setPickupMarker(position.coords.latitude, position.coords.longitude);

                // Reset input styling
                if (pickupInput) {
                    pickupInput.placeholder = 'Search for pickup location...';
                    pickupInput.style.backgroundColor = '';
                }
            },
            error => {
                console.log('Could not get location automatically:', error.message);

                // Reset input styling and show manual option
                if (pickupInput) {
                    pickupInput.placeholder = 'Search for pickup location or click 📍';
                    pickupInput.style.backgroundColor = '';
                }

                // Don't show an alert for auto-load, just silently fall back
                // Users can still use the manual button if needed
            },
            {
                // Options for better accuracy and faster response
                enableHighAccuracy: true,
                timeout: 10000, // 10 seconds timeout
                maximumAge: 300000 // Accept 5-minute old location
            }
        );
    } else {
        console.log('Geolocation not supported');
        // Fallback - no alert needed for auto-load
    }
};

// Get current location (manual button click)
window.getCurrentLocation = () => {
    if (navigator.geolocation) {
        // Show immediate feedback for manual request
        const pickupInput = document.getElementById('pickupSearchInput');
        if (pickupInput) {
            pickupInput.placeholder = '📍 Getting your location...';
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                setPickupMarker(position.coords.latitude, position.coords.longitude);

                if (pickupInput) {
                    pickupInput.placeholder = 'Search for pickup location...';
                }
            },
            error => {
                if (pickupInput) {
                    pickupInput.placeholder = 'Search for pickup location...';
                }

                // Show alert for manual requests since user explicitly clicked
                alert('Could not get your location. Please search for your pickup location or try again.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000 // 1 minute for manual requests
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please search for your pickup location.');
    }
};

// Set pickup marker
function setPickupMarker(lat, lng, address = null) {
    if (pickupMarker) bookingMap.removeLayer(pickupMarker);

    pickupMarker = L.marker([lat, lng]).addTo(bookingMap);
    pickupMarker.bindPopup('🏠 Pickup Location').openPopup();
    bookingMap.setView([lat, lng], 15);

    if (address) {
        // Update input field
        const input = document.getElementById('pickupSearchInput');
        if (input) input.value = address;

        dotNetRef.invokeMethodAsync('UpdatePickupLocation', lat, lng, address);
    } else {
        // Get address from coordinates
        getAddressFromCoords(lat, lng, (resolvedAddress) => {
            const input = document.getElementById('pickupSearchInput');
            if (input) input.value = resolvedAddress;
            dotNetRef.invokeMethodAsync('UpdatePickupLocation', lat, lng, resolvedAddress);
        });
    }

    updateRoute();
}

// Set destination marker
function setDestinationMarker(lat, lng, address = null) {
    if (destinationMarker) bookingMap.removeLayer(destinationMarker);

    destinationMarker = L.marker([lat, lng]).addTo(bookingMap);
    destinationMarker.bindPopup('🎯 Destination').openPopup();

    if (address) {
        // Update input field
        const input = document.getElementById('destinationSearchInput');
        if (input) input.value = address;

        dotNetRef.invokeMethodAsync('UpdateDestination', lat, lng, address);
    } else {
        // Get address from coordinates
        getAddressFromCoords(lat, lng, (resolvedAddress) => {
            const input = document.getElementById('destinationSearchInput');
            if (input) input.value = resolvedAddress;
            dotNetRef.invokeMethodAsync('UpdateDestination', lat, lng, resolvedAddress);
        });
    }

    updateRoute();
}

// ENHANCED ROUTE CALCULATION FUNCTIONS

// Generate cache key for route
function generateRouteKey(pickup, destination) {
    return `${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)}-${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
}

// Calculate route using OpenRouteService API
async function calculateRoute(pickupCoords, destinationCoords) {
    const cacheKey = generateRouteKey(pickupCoords, destinationCoords);

    // Check cache first
    if (routeCache.has(cacheKey)) {
        console.log('Using cached route');
        return routeCache.get(cacheKey);
    }

    try {
        const url = `${ROUTING_CONFIG.BASE_URL}?api_key=${ROUTING_CONFIG.API_KEY}&start=${pickupCoords.lng},${pickupCoords.lat}&end=${destinationCoords.lng},${destinationCoords.lat}&radiuses=-1,-1&instructions=false`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            throw new Error('No route found');
        }

        const route = data.features[0];
        const routeData = {
            distance: Math.round(route.properties.summary.distance / 1000 * 100) / 100, // km, rounded to 2 decimals
            duration: Math.round(route.properties.summary.duration / 60), // minutes, rounded
            geometry: route.geometry.coordinates,
            success: true
        };

        // Cache the result (with expiry - routes can change due to traffic)
        routeCache.set(cacheKey, routeData);

        // Clean cache after 10 minutes
        setTimeout(() => {
            routeCache.delete(cacheKey);
        }, 10 * 60 * 1000);

        return routeData;

    } catch (error) {
        console.error('Route calculation failed:', error);

        if (ROUTING_CONFIG.FALLBACK_TO_STRAIGHT_LINE) {
            return calculateStraightLineRoute(pickupCoords, destinationCoords);
        } else {
            throw error;
        }
    }
}

// Fallback to straight-line calculation
function calculateStraightLineRoute(pickup, destination) {
    const distance = calculateStraightLineDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);

    return {
        distance: Math.round(distance * 100) / 100,
        duration: Math.round(distance * 2), // Rough estimate: 2 minutes per km in city traffic
        geometry: [[pickup.lng, pickup.lat], [destination.lng, destination.lat]],
        success: false, // Indicates this is a fallback
        fallback: true
    };
}

// Calculate straight-line distance (Haversine formula)
function calculateStraightLineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Show route loading indicator
function showRouteLoading() {
    // You can add a loading spinner to your UI here
    console.log('Calculating route...');

    // Optional: Add loading overlay to map
    if (typeof dotNetRef !== 'undefined') {
        dotNetRef.invokeMethodAsync('OnRouteCalculationStart');
    }
}

// Hide route loading indicator
function hideRouteLoading() {
    console.log('Route calculation complete');

    if (typeof dotNetRef !== 'undefined') {
        dotNetRef.invokeMethodAsync('OnRouteCalculationComplete');
    }
}

// Update route display with actual routing
async function updateRoute() {
    if (pickupMarker && destinationMarker) {
        if (routeLine) bookingMap.removeLayer(routeLine);

        const pickup = pickupMarker.getLatLng();
        const destination = destinationMarker.getLatLng();

        // Show loading indicator
        showRouteLoading();

        try {
            // Calculate actual route
            const routeData = await calculateRoute(pickup, destination);

            // Convert coordinates for Leaflet (OpenRouteService returns [lng, lat])
            const leafletCoords = routeData.geometry.map(coord => [coord[1], coord[0]]);

            // Create route line
            routeLine = L.polyline(leafletCoords, {
                color: routeData.success ? '#28a745' : '#ffc107', // Green for real route, yellow for fallback
                weight: 4,
                opacity: 0.8,
                dashArray: routeData.fallback ? '10, 5' : null // Dashed line for fallback
            }).addTo(bookingMap);

            // Add route popup with details
            const popupContent = `
                <div style="text-align: center;">
                    <strong>🚗 Route Details</strong><br>
                    📏 Distance: <strong>${routeData.distance} km</strong><br>
                    ⏱️ Duration: <strong>${routeData.duration} min</strong><br>
                    ${routeData.fallback ? '<small style="color: #856404;">⚠️ Estimated route (offline)</small>' : '<small style="color: #155724;">✅ Actual route</small>'}
                </div>
            `;

            routeLine.bindPopup(popupContent);

            // Fit map to show entire route
            const group = L.featureGroup([pickupMarker, destinationMarker, routeLine]);
            bookingMap.fitBounds(group.getBounds(), { padding: [30, 30] });

            // Update .NET backend with route information
            if (dotNetRef) {
                dotNetRef.invokeMethodAsync('UpdateRouteInformation', {
                    distance: routeData.distance,
                    duration: routeData.duration,
                    isActualRoute: routeData.success,
                    pickupLat: pickup.lat,
                    pickupLng: pickup.lng,
                    destinationLat: destination.lat,
                    destinationLng: destination.lng
                });
            }

        } catch (error) {
            console.error('Failed to calculate route:', error);

            // Show error message and fall back to simple line
            routeLine = L.polyline([pickup, destination], {
                color: '#dc3545',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 5'
            }).addTo(bookingMap);

            routeLine.bindPopup('<div style="color: #721c24;"><strong>⚠️ Route calculation failed</strong><br>Showing direct line</div>');

            const group = L.featureGroup([pickupMarker, destinationMarker]);
            bookingMap.fitBounds(group.getBounds(), { padding: [30, 30] });

        } finally {
            hideRouteLoading();
        }
    }
}

// Public function to update API key
window.setRoutingApiKey = (apiKey) => {
    ROUTING_CONFIG.API_KEY = apiKey;
};

// Public function to get route information (can be called from .NET)
window.getRouteInformation = async () => {
    if (pickupMarker && destinationMarker) {
        const pickup = pickupMarker.getLatLng();
        const destination = destinationMarker.getLatLng();

        try {
            const routeData = await calculateRoute(pickup, destination);
            return {
                distance: routeData.distance,
                duration: routeData.duration,
                isActualRoute: routeData.success,
                success: true
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    return {
        success: false,
        error: 'No pickup or destination selected'
    };
};

// Get address from coordinates using reverse geocoding
function getAddressFromCoords(lat, lng, callback) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(response => response.json())
        .then(data => {
            const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            callback(address);
        })
        .catch(() => {
            callback(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        });
}

// Clear the booking map
window.clearBookingMap = () => {
    if (pickupMarker) {
        bookingMap.removeLayer(pickupMarker);
        pickupMarker = null;
    }
    if (destinationMarker) {
        bookingMap.removeLayer(destinationMarker);
        destinationMarker = null;
    }
    if (routeLine) {
        bookingMap.removeLayer(routeLine);
        routeLine = null;
    }

    // Clear route cache
    routeCache.clear();

    bookingMap.setView([40.7128, -74.0060], 12);
};

// Clear input fields
window.clearInputs = () => {
    const pickupInput = document.getElementById('pickupSearchInput');
    const destinationInput = document.getElementById('destinationSearchInput');

    if (pickupInput) pickupInput.value = '';
    if (destinationInput) destinationInput.value = '';

    hideSuggestions('pickup');
    hideSuggestions('destination');
};