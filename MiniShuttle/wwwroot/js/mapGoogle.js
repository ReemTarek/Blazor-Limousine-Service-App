let bookingMap;
let pickupMarker;
let destinationMarker;
let routeLine;
let dotNetRef;
let searchTimeout;
let selectedSuggestionIndex = -1;
let directionsService;
let directionsRenderer;
let placesService;
let autocompletePickup;
let autocompleteDestination;

// Google Maps configuration
const GOOGLE_MAPS_CONFIG = {
    // You'll need to get your Google Maps API key from Google Cloud Console
    API_KEY: "my actual key", // Replace with your actual API key
    // Map options
    MAP_OPTIONS: {
        zoom: 12,
        center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_CENTER,
        }
    },
    // Autocomplete options
    AUTOCOMPLETE_OPTIONS: {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'egy' }, // Restrict to US, change as needed
        fields: ['place_id', 'geometry', 'name', 'formatted_address', 'address_components']
    },
    // Directions options
    DIRECTIONS_OPTIONS: {
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false,
        optimizeWaypoints: true
    }
};

// Route cache to avoid repeated API calls
const routeCache = new Map();

// Initialize Google Maps
function initGoogleMaps() {
    if (typeof google === 'undefined' || !google.maps) {
        console.error('Google Maps API not loaded');
        return false;
    }
    return true;
}

// Initialize the booking map
window.initBookingMap = (dotNetReference) => {
    if (!initGoogleMaps()) {
        console.error('Failed to initialize Google Maps');
        return;
    }

    dotNetRef = dotNetReference;

    // Initialize map
    const mapElement = document.getElementById('bookingMap');
    if (!mapElement) {
        console.error('Map element not found');
        return;
    }

    bookingMap = new google.maps.Map(mapElement, GOOGLE_MAPS_CONFIG.MAP_OPTIONS);

    // Initialize services
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: false,
        suppressMarkers: true, // We'll use custom markers
        polylineOptions: {
            strokeColor: '#28a745',
            strokeWeight: 4,
            strokeOpacity: 0.8
        }
    });
    directionsRenderer.setMap(bookingMap);

    placesService = new google.maps.places.PlacesService(bookingMap);

    // Add click listener for destination selection
    bookingMap.addListener('click', function (e) {
        setDestinationMarker(e.latLng.lat(), e.latLng.lng());
    });

    // Try to center map on user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                bookingMap.setCenter(userLocation);
                bookingMap.setZoom(14);
            },
            (error) => {
                console.log('Could not get user location:', error);
            }
        );
    }
};

// Initialize autocomplete functionality
window.initAutocomplete = () => {
    if (!initGoogleMaps()) return;

    const pickupInput = document.getElementById('pickupSearchInput');
    const destinationInput = document.getElementById('destinationSearchInput');

    if (pickupInput) {
        autocompletePickup = new google.maps.places.Autocomplete(pickupInput, GOOGLE_MAPS_CONFIG.AUTOCOMPLETE_OPTIONS);
        autocompletePickup.addListener('place_changed', () => {
            const place = autocompletePickup.getPlace();
            if (place.geometry) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                setPickupMarker(lat, lng, place.formatted_address);
            }
        });
    }

    if (destinationInput) {
        autocompleteDestination = new google.maps.places.Autocomplete(destinationInput, GOOGLE_MAPS_CONFIG.AUTOCOMPLETE_OPTIONS);
        autocompleteDestination.addListener('place_changed', () => {
            const place = autocompleteDestination.getPlace();
            if (place.geometry) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                setDestinationMarker(lat, lng, place.formatted_address);
            }
        });
    }
};

// Manual search function (fallback for custom implementation)
window.searchLocation = async (query, type) => {
    if (!query || query.length < 3) return;

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const request = {
            query: query,
            fields: ['place_id', 'geometry', 'name', 'formatted_address'],
        };

        placesService.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                showGooglePlacesSuggestions(results, type);
            } else {
                console.error('Places search failed:', status);
                showErrorSuggestion(document.getElementById(type + 'Suggestions'));
            }
        });
    }, 300);
};

// Show Google Places suggestions
function showGooglePlacesSuggestions(results, type) {
    const container = document.getElementById(type + 'Suggestions');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<div class="loading-suggestion">No results found</div>';
        container.style.display = 'block';
        return;
    }

    const suggestionsHtml = results.slice(0, 5).map((place, index) => {
        const name = place.name || '';
        const address = place.formatted_address || '';

        return `<div class="autocomplete-suggestion" 
                     data-place-id="${place.place_id}"
                     data-lat="${place.geometry.location.lat()}" 
                     data-lng="${place.geometry.location.lng()}" 
                     data-address="${address}"
                     data-index="${index}">
                    <strong>${name}</strong>
                    <br><small class="text-muted">${address}</small>
                </div>`;
    }).join('');

    container.innerHTML = suggestionsHtml;
    container.style.display = 'block';
    selectedSuggestionIndex = -1;

    // Add click event listeners
    container.querySelectorAll('.autocomplete-suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', () => selectGooglePlacesSuggestion(suggestion, type));
    });
}

// Select a Google Places suggestion
function selectGooglePlacesSuggestion(suggestion, type) {
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

// Show error message
function showErrorSuggestion(container) {
    if (container) {
        container.innerHTML = '<div class="loading-suggestion">❌ Search failed. Please try again.</div>';
        container.style.display = 'block';
    }
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
        const pickupInput = document.getElementById('pickupSearchInput');
        if (pickupInput) {
            pickupInput.placeholder = '📍 Getting your location...';
            pickupInput.style.backgroundColor = '#f8f9fa';
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                setPickupMarker(position.coords.latitude, position.coords.longitude);

                if (pickupInput) {
                    pickupInput.placeholder = 'Search for pickup location...';
                    pickupInput.style.backgroundColor = '';
                }
            },
            error => {
                console.log('Could not get location automatically:', error.message);

                if (pickupInput) {
                    pickupInput.placeholder = 'Search for pickup location or click 📍';
                    pickupInput.style.backgroundColor = '';
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    }
};

// Get current location (manual button click)
window.getCurrentLocation = () => {
    if (navigator.geolocation) {
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
                alert('Could not get your location. Please search for your pickup location or try again.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please search for your pickup location.');
    }
};

// Set pickup marker
function setPickupMarker(lat, lng, address = null) {
    if (pickupMarker) {
        pickupMarker.setMap(null);
    }

    const position = new google.maps.LatLng(lat, lng);

    pickupMarker = new google.maps.Marker({
        position: position,
        map: bookingMap,
        title: 'Pickup Location',
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#28a745" stroke="white" stroke-width="3"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-size="12">🏠</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        }
    });

    const infoWindow = new google.maps.InfoWindow({
        content: '🏠 Pickup Location'
    });

    pickupMarker.addListener('click', () => {
        infoWindow.open(bookingMap, pickupMarker);
    });

    bookingMap.setCenter(position);
    bookingMap.setZoom(15);

    if (address) {
        const input = document.getElementById('pickupSearchInput');
        if (input) input.value = address;
        dotNetRef.invokeMethodAsync('UpdatePickupLocation', lat, lng, address);
    } else {
        // Get address from coordinates using Google Geocoding
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
    if (destinationMarker) {
        destinationMarker.setMap(null);
    }

    const position = new google.maps.LatLng(lat, lng);

    destinationMarker = new google.maps.Marker({
        position: position,
        map: bookingMap,
        title: 'Destination',
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#dc3545" stroke="white" stroke-width="3"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-size="12">🎯</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        }
    });

    const infoWindow = new google.maps.InfoWindow({
        content: '🎯 Destination'
    });

    destinationMarker.addListener('click', () => {
        infoWindow.open(bookingMap, destinationMarker);
    });

    if (address) {
        const input = document.getElementById('destinationSearchInput');
        if (input) input.value = address;
        dotNetRef.invokeMethodAsync('UpdateDestination', lat, lng, address);
    } else {
        // Get address from coordinates using Google Geocoding
        getAddressFromCoords(lat, lng, (resolvedAddress) => {
            const input = document.getElementById('destinationSearchInput');
            if (input) input.value = resolvedAddress;
            dotNetRef.invokeMethodAsync('UpdateDestination', lat, lng, resolvedAddress);
        });
    }

    updateRoute();
}

// Generate cache key for route
function generateRouteKey(pickup, destination) {
    return `${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)}-${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
}

// Calculate route using Google Directions API
async function calculateRoute(pickupCoords, destinationCoords) {
    const cacheKey = generateRouteKey(pickupCoords, destinationCoords);

    // Check cache first
    if (routeCache.has(cacheKey)) {
        console.log('Using cached route');
        return routeCache.get(cacheKey);
    }

    return new Promise((resolve, reject) => {
        const request = {
            origin: new google.maps.LatLng(pickupCoords.lat, pickupCoords.lng),
            destination: new google.maps.LatLng(destinationCoords.lat, destinationCoords.lng),
            travelMode: GOOGLE_MAPS_CONFIG.DIRECTIONS_OPTIONS.travelMode,
            unitSystem: GOOGLE_MAPS_CONFIG.DIRECTIONS_OPTIONS.unitSystem,
            avoidHighways: GOOGLE_MAPS_CONFIG.DIRECTIONS_OPTIONS.avoidHighways,
            avoidTolls: GOOGLE_MAPS_CONFIG.DIRECTIONS_OPTIONS.avoidTolls,
            optimizeWaypoints: GOOGLE_MAPS_CONFIG.DIRECTIONS_OPTIONS.optimizeWaypoints
        };

        directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
                const route = result.routes[0];
                const leg = route.legs[0];
                console.log(Math.round(leg.distance.value / 1000 * 100) / 100)
                const routeData = {
                    distance: Math.round(leg.distance.value / 1000 * 100) / 100, // km, rounded to 2 decimals
                    duration: Math.round(leg.duration.value / 60), // minutes, rounded
                    directionsResult: result,
                    success: true
                };

                // Cache the result (with expiry)
                routeCache.set(cacheKey, routeData);

                // Clean cache after 10 minutes
                setTimeout(() => {
                    routeCache.delete(cacheKey);
                }, 10 * 60 * 1000);

                resolve(routeData);
            } else {
                console.error('Directions request failed:', status);

                // Fallback to straight line calculation
                const fallbackData = calculateStraightLineRoute(pickupCoords, destinationCoords);
                resolve(fallbackData);
            }
        });
    });
}

// Fallback to straight-line calculation
function calculateStraightLineRoute(pickup, destination) {
    const distance = calculateStraightLineDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);

    return {
        distance: Math.round(distance * 100) / 100,
        duration: Math.round(distance * 2), // Rough estimate: 2 minutes per km in city traffic
        success: false,
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
    console.log('Calculating route...');
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

// Update route display with Google Directions
async function updateRoute() {
    if (pickupMarker && destinationMarker) {
        const pickup = pickupMarker.getPosition();
        const destination = destinationMarker.getPosition();

        showRouteLoading();

        try {
            const routeData = await calculateRoute(
                { lat: pickup.lat(), lng: pickup.lng() },
                { lat: destination.lat(), lng: destination.lng() }
            );

            if (routeData.success && routeData.directionsResult) {
                // Use Google Directions Renderer for the route
                directionsRenderer.setDirections(routeData.directionsResult);

                // Fit bounds to show entire route
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(pickup);
                bounds.extend(destination);
                bookingMap.fitBounds(bounds, { padding: 50 });

            } else {
                // Fallback: show simple line
                if (routeLine) {
                    routeLine.setMap(null);
                }

                routeLine = new google.maps.Polyline({
                    path: [pickup, destination],
                    geodesic: true,
                    strokeColor: '#ffc107',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    strokeDashArray: [10, 5]
                });

                routeLine.setMap(bookingMap);

                const bounds = new google.maps.LatLngBounds();
                bounds.extend(pickup);
                bounds.extend(destination);
                bookingMap.fitBounds(bounds, { padding: 50 });
            }

            // Update .NET backend with route information
            if (dotNetRef) {
                dotNetRef.invokeMethodAsync('UpdateRouteInformation', {
                    distance: routeData.distance,
                    duration: routeData.duration,
                    isActualRoute: routeData.success,
                    pickupLat: pickup.lat(),
                    pickupLng: pickup.lng(),
                    destinationLat: destination.lat(),
                    destinationLng: destination.lng()
                });
            }

        } catch (error) {
            console.error('Failed to calculate route:', error);

            // Show error line
            if (routeLine) {
                routeLine.setMap(null);
            }

            routeLine = new google.maps.Polyline({
                path: [pickup, destination],
                geodesic: true,
                strokeColor: '#dc3545',
                strokeOpacity: 0.7,
                strokeWeight: 4,
                strokeDashArray: [10, 5]
            });

            routeLine.setMap(bookingMap);

        } finally {
            hideRouteLoading();
        }
    }
}

// Public function to get route information
window.getRouteInformation = async () => {
    if (pickupMarker && destinationMarker) {
        const pickup = pickupMarker.getPosition();
        const destination = destinationMarker.getPosition();

        try {
            const routeData = await calculateRoute(
                { lat: pickup.lat(), lng: pickup.lng() },
                { lat: destination.lat(), lng: destination.lng() }
            );
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

// Get address from coordinates using Google Geocoding
function getAddressFromCoords(lat, lng, callback) {
    const geocoder = new google.maps.Geocoder();
    const latlng = new google.maps.LatLng(lat, lng);

    geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
            callback(results[0].formatted_address);
        } else {
            console.error('Geocoding failed:', status);
            callback(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
    });
}

// Clear the booking map
window.clearBookingMap = () => {
    if (pickupMarker) {
        pickupMarker.setMap(null);
        pickupMarker = null;
    }
    if (destinationMarker) {
        destinationMarker.setMap(null);
        destinationMarker = null;
    }
    if (routeLine) {
        routeLine.setMap(null);
        routeLine = null;
    }

    // Clear directions renderer
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }

    // Clear route cache
    routeCache.clear();

    // Reset map view
    bookingMap.setCenter(GOOGLE_MAPS_CONFIG.MAP_OPTIONS.center);
    bookingMap.setZoom(GOOGLE_MAPS_CONFIG.MAP_OPTIONS.zoom);
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

// Set Google Maps API key (called from Blazor)
window.setGoogleMapsApiKey = (apiKey) => {
    GOOGLE_MAPS_CONFIG.API_KEY = apiKey;
};

// Legacy compatibility function (for routing API key)
window.setRoutingApiKey = (apiKey) => {
    // Not needed for Google Maps, but keeping for compatibility
    console.log('Routing API key set (using Google Maps instead)');
};