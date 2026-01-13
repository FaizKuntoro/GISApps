/**
 * ============================================
 * NAVIGATION & NEARBY FACILITIES APP
 * ============================================
 * This application provides:
 * - User location detection
 * - Nearby facilities search using Overpass API
 * - Route navigation using OSRM
 * - Facility filtering by category and radius
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

// Map instance
let map;

// Current location marker (user's location or clicked point)
let currentLocationMarker = null;

// Store current location coordinates
let currentLocation = null;

// Array to store facility markers
let facilityMarkers = [];

// Route polyline layer
let routeLayer = null;

// Current map style
let currentMapStyle = 'osm'; // 'osm', 'dark', 'light'
let currentTileLayer = null;

// Available map styles
const mapStyles = {
    osm: {
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    dark: {
        name: 'Dark Mode',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    light: {
        name: 'Light Mode',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
};

// Category name mapping (Indonesian)
const categoryNames = {
    'hospital': 'Rumah Sakit',
    'clinic': 'Klinik',
    'school': 'Sekolah',
    'university': 'Universitas',
    'atm': 'ATM',
    'restaurant': 'Restoran',
    'cafe': 'Kafe',
    'fuel': 'SPBU',
    'all': 'Semua Fasilitas'
};

// ============================================
// CUSTOM MARKER ICONS
// ============================================

/**
 * Create custom icons for different marker types
 */
const locationIcon = L.divIcon({
    className: 'custom-marker location-marker',
    html: '<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

const facilityIcon = L.divIcon({
    className: 'custom-marker facility-marker',
    html: '<div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
});

// ============================================
// MAP INITIALIZATION
// ============================================

/**
 * Initialize the Leaflet map
 * Default center: Jakarta, Indonesia
 */
function initMap() {
    const defaultCenter = [-6.2, 106.8];
    const defaultZoom = 14;

    map = L.map('map').setView(defaultCenter, defaultZoom);

    // Add initial tile layer
    setMapStyle('osm');

    // Add click event to set current location
    map.on('click', handleMapClick);

    console.log('Map initialized');
}

/**
 * Change map tile layer style
 * @param {string} style - Map style key ('osm', 'dark', 'light')
 */
function setMapStyle(style) {
    if (!mapStyles[style]) {
        console.error('Invalid map style:', style);
        return;
    }

    // Remove existing tile layer
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }

    // Add new tile layer
    const styleConfig = mapStyles[style];
    currentTileLayer = L.tileLayer(styleConfig.url, {
        maxZoom: 19,
        attribution: styleConfig.attribution
    }).addTo(map);

    currentMapStyle = style;
    console.log('Map style changed to:', styleConfig.name);
}

/**
 * Toggle between map styles
 */
function toggleMapStyle() {
    const styles = ['osm', 'light', 'dark'];
    const currentIndex = styles.indexOf(currentMapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    const nextStyle = styles[nextIndex];
    
    setMapStyle(nextStyle);
    
    // Update button text
    const btn = document.getElementById('toggleMapStyle');
    const styleNames = { osm: 'OSM', light: 'Terang', dark: 'Gelap' };
    btn.textContent = `🗺️ ${styleNames[nextStyle]}`;
}

/**
 * Handle map click events to set search center point
 */
function handleMapClick(e) {
    const latlng = e.latlng;
    setCurrentLocation(latlng.lat, latlng.lng, 'Titik Pusat Pencarian');
    console.log('Search center set by map click:', latlng);
}

// ============================================
// GEOLOCATION
// ============================================

/**
 * Get user's current location using Geolocation API
 * and set it as the search center
 */
function useMyLocation() {
    if (!navigator.geolocation) {
        alert('Geolokasi tidak didukung oleh browser Anda.');
        return;
    }

    const locationBtn = document.getElementById('useMyLocation');
    locationBtn.textContent = '⏳ Mencari lokasi...';
    locationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            setCurrentLocation(lat, lng, 'Lokasi Saya');
            map.setView([lat, lng], 15);

            locationBtn.textContent = '✅ Lokasi Ditemukan';
            setTimeout(() => {
                locationBtn.textContent = '📍 Gunakan Lokasi Saya';
                locationBtn.disabled = false;
            }, 2000);

            console.log('User location found:', { lat, lng });
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('Gagal mendapatkan lokasi, silakan aktifkan GPS atau izin lokasi.');
            
            locationBtn.textContent = '📍 Gunakan Lokasi Saya';
            locationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

/**
 * Set current location and update marker
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} label - Marker popup label
 */
function setCurrentLocation(lat, lng, label = 'Lokasi Saya') {
    currentLocation = { lat, lng };

    // Remove existing marker
    if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
    }

    // Add new marker
    currentLocationMarker = L.marker([lat, lng], { icon: locationIcon })
        .addTo(map)
        .bindPopup(`<strong>${label}</strong><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
        .openPopup();

    console.log('Current location set:', currentLocation);
}

// ============================================
// HAVERSINE DISTANCE CALCULATION
// ============================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 * 
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Format distance for display
 * 
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(2)} km`;
    }
}

// ============================================
// OVERPASS API - FACILITY SEARCH
// ============================================

/**
 * Search for nearby facilities using Overpass API
 * 
 * The Overpass API allows querying OpenStreetMap data.
 * We build a query to find nodes with specific amenity tags
 * within a radius around the center point.
 * 
 * @param {Object} centerLatLng - Center point {lat, lng}
 * @param {string} category - Amenity category (e.g., 'hospital', 'atm', 'all')
 * @param {number} radius - Search radius in meters
 */
async function searchFacilities(centerLatLng, category, radius) {
    const { lat, lng } = centerLatLng;

    // Clear previous facilities
    clearFacilities();

    // Show loading state
    const searchBtn = document.getElementById('searchFacilities');
    searchBtn.classList.add('loading');
    searchBtn.disabled = true;

    // Build Overpass query
    let query;
    
    if (category === 'all') {
        // Query for all supported amenity types
        const amenities = ['hospital', 'clinic', 'school', 'university', 'atm', 'restaurant', 'cafe', 'fuel'];
        const nodeQueries = amenities.map(amenity => 
            `node["amenity"="${amenity}"](around:${radius},${lat},${lng});`
        ).join('\n  ');
        
        query = `
[out:json][timeout:25];
(
  ${nodeQueries}
);
out body;
`;
    } else {
        // Query for specific amenity type
        query = `
[out:json][timeout:25];
node["amenity"="${category}"](around:${radius},${lat},${lng});
out body;
`;
    }

    console.log('Overpass query:', query);

    try {
        const overpassUrl = 'https://overpass-api.de/api/interpreter';
        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: query
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Overpass API response:', data);

        // Process facilities from response
        const facilities = processFacilities(data.elements, centerLatLng);

        // Display facilities
        if (facilities.length > 0) {
            displayFacilities(facilities);
        } else {
            showNoResults(category);
        }

    } catch (error) {
        console.error('Error fetching facilities:', error);
        alert('Gagal mencari fasilitas. Silakan coba lagi.');
        document.getElementById('facility-list').innerHTML = 
            '<div class="no-results">❌ Terjadi kesalahan saat mencari fasilitas.</div>';
    } finally {
        searchBtn.classList.remove('loading');
        searchBtn.disabled = false;
    }
}

/**
 * Process facility data from Overpass API response
 * Calculate distances and sort by proximity
 * 
 * @param {Array} elements - Array of OSM elements from Overpass
 * @param {Object} centerLatLng - Center point for distance calculation
 * @returns {Array} Processed and sorted facilities
 */
function processFacilities(elements, centerLatLng) {
    const facilities = elements
        .filter(element => element.type === 'node' && element.lat && element.lon)
        .map(element => {
            const distance = calculateDistance(
                centerLatLng.lat,
                centerLatLng.lng,
                element.lat,
                element.lon
            );

            return {
                id: element.id,
                name: element.tags.name || 'Tanpa nama',
                amenity: element.tags.amenity || 'unknown',
                lat: element.lat,
                lng: element.lon,
                distance: distance,
                tags: element.tags
            };
        });

    // Sort by distance (nearest first)
    facilities.sort((a, b) => a.distance - b.distance);

    // Limit to 20 nearest facilities
    return facilities.slice(0, 20);
}

/**
 * Display facilities on map and in sidebar list
 * 
 * @param {Array} facilities - Array of facility objects
 */
function displayFacilities(facilities) {
    console.log(`Displaying ${facilities.length} facilities`);

    // Clear previous markers
    clearFacilityMarkers();

    // Prepare list HTML
    let listHTML = `<h3>📍 ${facilities.length} Fasilitas Ditemukan</h3>`;

    facilities.forEach((facility, index) => {
        // Add marker to map
        const marker = L.marker([facility.lat, facility.lng], { icon: facilityIcon })
            .addTo(map)
            .bindPopup(createFacilityPopup(facility));

        // Store marker reference with facility data
        marker.facilityData = facility;
        facilityMarkers.push(marker);

        // Create list card
        listHTML += createFacilityCard(facility, index);
    });

    // Update sidebar
    document.getElementById('facility-list').innerHTML = listHTML;

    // Attach event listeners to cards and buttons
    attachFacilityEventListeners(facilities);

    // Fit map to show all facilities plus current location
    fitMapToFacilities();
}

/**
 * Create HTML for facility popup
 * 
 * @param {Object} facility - Facility object
 * @returns {string} HTML string
 */
function createFacilityPopup(facility) {
    const categoryName = categoryNames[facility.amenity] || facility.amenity;
    const distanceText = formatDistance(facility.distance);

    return `
        <div class="popup-title">${facility.name}</div>
        <div class="popup-type">📍 ${categoryName}</div>
        <div class="popup-distance">📏 ${distanceText} dari pusat</div>
        <button class="popup-btn" onclick="showRouteToFacility(${facility.lat}, ${facility.lng})">
            🚗 Tampilkan Rute
        </button>
    `;
}

/**
 * Create HTML for facility card in sidebar
 * 
 * @param {Object} facility - Facility object
 * @param {number} index - Facility index
 * @returns {string} HTML string
 */
function createFacilityCard(facility, index) {
    const categoryName = categoryNames[facility.amenity] || facility.amenity;
    const distanceText = formatDistance(facility.distance);

    return `
        <div class="facility-card" data-index="${index}">
            <div class="facility-name">${index + 1}. ${facility.name}</div>
            <div class="facility-type">📍 ${categoryName}</div>
            <div class="facility-distance">📏 ${distanceText}</div>
            <div class="facility-actions">
                <button class="btn-route" data-index="${index}">🚗 Tampilkan Rute</button>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners to facility cards and route buttons
 * 
 * @param {Array} facilities - Array of facility objects
 */
function attachFacilityEventListeners(facilities) {
    // Card click - pan to marker and open popup
    document.querySelectorAll('.facility-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking the route button
            if (e.target.classList.contains('btn-route')) return;

            const index = parseInt(card.getAttribute('data-index'));
            const marker = facilityMarkers[index];
            
            if (marker) {
                map.setView([marker.getLatLng().lat, marker.getLatLng().lng], 16);
                marker.openPopup();
            }
        });
    });

    // Route button click
    document.querySelectorAll('.btn-route').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.getAttribute('data-index'));
            const facility = facilities[index];
            
            if (facility) {
                showRouteToFacility(facility.lat, facility.lng);
            }
        });
    });
}

/**
 * Show message when no facilities are found
 * 
 * @param {string} category - Category that was searched
 */
function showNoResults(category) {
    const categoryName = categoryNames[category] || category;
    document.getElementById('facility-list').innerHTML = `
        <div class="no-results">
            ❌ Tidak ditemukan fasilitas untuk kategori "${categoryName}" di radius tersebut.
            <br><br>
            Coba perbesar radius atau pilih kategori lain.
        </div>
    `;
}

/**
 * Clear all facility markers from map
 */
function clearFacilityMarkers() {
    facilityMarkers.forEach(marker => map.removeLayer(marker));
    facilityMarkers = [];
}

/**
 * Clear facilities and reset list
 */
function clearFacilities() {
    clearFacilityMarkers();
    clearRoute();
}

/**
 * Fit map bounds to show all facilities and current location
 */
function fitMapToFacilities() {
    if (facilityMarkers.length === 0) return;

    const bounds = L.latLngBounds();
    
    // Add facility markers to bounds
    facilityMarkers.forEach(marker => {
        bounds.extend(marker.getLatLng());
    });

    // Add current location to bounds
    if (currentLocation) {
        bounds.extend([currentLocation.lat, currentLocation.lng]);
    }

    map.fitBounds(bounds, { padding: [50, 50] });
}

// ============================================
// OSRM ROUTING
// ============================================

/**
 * Get route from current location to a facility using OSRM
 * Display route on map with distance and duration info
 * 
 * OSRM API format: /route/v1/driving/lng1,lat1;lng2,lat2
 * Note: OSRM uses lng,lat order (longitude first!)
 * 
 * @param {number} destLat - Destination latitude
 * @param {number} destLng - Destination longitude
 */
async function showRouteToFacility(destLat, destLng) {
    // Validate that current location is set
    if (!currentLocation) {
        alert('Silakan pilih "Gunakan Lokasi Saya" atau klik peta untuk memilih titik pusat.');
        return;
    }

    // Clear previous route
    clearRoute();

    const { lat: startLat, lng: startLng } = currentLocation;

    // Build OSRM URL (note: lng,lat format!)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;

    console.log('Requesting route from OSRM:', osrmUrl);

    try {
        const response = await fetch(osrmUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }

        const route = data.routes[0];
        const routeGeometry = route.geometry;
        const distanceMeters = route.distance;
        const durationSeconds = route.duration;

        // Convert units
        const distanceKm = (distanceMeters / 1000).toFixed(2);
        const durationMinutes = Math.ceil(durationSeconds / 60);

        console.log('Route found:', { distanceKm, durationMinutes });

        // Draw route on map
        // GeoJSON uses [lng, lat] format, need to swap for Leaflet
        const routeCoords = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);

        routeLayer = L.polyline(routeCoords, {
            color: '#00d9ff',  // Bright cyan for high visibility
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round',
            className: 'route-line'
        }).addTo(map);

        // Fit map to route
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Display route info
        displayRouteInfo(distanceKm, durationMinutes);

    } catch (error) {
        console.error('Error getting route:', error);
        alert('Gagal mendapatkan rute, silakan coba lagi.');
    }
}

/**
 * Display route information panel
 * 
 * @param {string} distanceKm - Distance in kilometers
 * @param {number} durationMinutes - Duration in minutes
 */
function displayRouteInfo(distanceKm, durationMinutes) {
    const routeInfo = document.getElementById('route-info');
    routeInfo.innerHTML = `
        <button class="close-btn" onclick="clearRoute()">✕</button>
        <div class="info-item">📏 Jarak: <span>${distanceKm} km</span></div>
        <div class="info-item">⏱️ Perkiraan waktu: <span>${durationMinutes} menit</span></div>
    `;
    routeInfo.classList.add('active');
}

/**
 * Clear route from map and hide route info
 */
function clearRoute() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }

    const routeInfo = document.getElementById('route-info');
    routeInfo.innerHTML = '';
    routeInfo.classList.remove('active');
}

// ============================================
// SEARCH HANDLER
// ============================================

/**
 * Handle facility search button click
 * Validates inputs and triggers search
 */
function handleSearchFacilities() {
    // Check if current location is set
    if (!currentLocation) {
        alert('Silakan pilih "Gunakan Lokasi Saya" atau klik peta untuk memilih titik pusat.');
        return;
    }

    // Get search parameters
    const category = document.getElementById('categorySelect').value;
    const radius = parseInt(document.getElementById('radiusInput').value) || 1000;

    // Validate radius
    if (radius < 100 || radius > 5000) {
        alert('Radius harus antara 100 dan 5000 meter.');
        return;
    }

    console.log('Searching facilities:', { category, radius, center: currentLocation });

    // Perform search
    searchFacilities(currentLocation, category, radius);
}

// ============================================
// DARK MODE & MAP STYLE TOGGLE
// ============================================

/**
 * Toggle dark mode for the UI
 */
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    
    // Update button text
    const btn = document.getElementById('toggleDarkMode');
    btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
    
    // Save preference
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
}

/**
 * Load dark mode preference from localStorage
 */
function loadDarkModePreference() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('toggleDarkMode');
        if (btn) btn.textContent = '☀️ Light Mode';
    }
}

// ============================================
// EVENT LISTENERS & INITIALIZATION
// ============================================

/**
 * Initialize app when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    initMap();

    // Load dark mode preference
    loadDarkModePreference();

    // Attach event listeners
    document.getElementById('useMyLocation').addEventListener('click', useMyLocation);
    document.getElementById('searchFacilities').addEventListener('click', handleSearchFacilities);
    document.getElementById('toggleMapStyle').addEventListener('click', toggleMapStyle);
    document.getElementById('toggleDarkMode').addEventListener('click', toggleDarkMode);

    // Allow Enter key in radius input to trigger search
    document.getElementById('radiusInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearchFacilities();
        }
    });

    console.log('Nearby Facilities App initialized');
    console.log('Click "Gunakan Lokasi Saya" or click on the map to set search center');
});
