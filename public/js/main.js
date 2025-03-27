import { loadPokemonList, pokedexMap, loadPokedex} from "../js/pokemon.js";
// import { db, collection, onSnapshot } from "./firebase.js";

// ✅ Import Firestore functions correctly
import { db, collection, addDoc, onSnapshot, deleteDoc, doc, GeoPoint, serverTimestamp, setDoc, updateDoc, getDoc } from "../../server/firebase.js";

// 🗺️ Define tile layers
const layers = [
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }), // Default
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google Satellite' }), // Google Satellite
    L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google Terrain' }), // Google Terrain
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri & OpenStreetMap contributors' }), // Esri Street Map
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri & OpenStreetMap contributors' }), // Esri Topo Map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB Dark Matter' }), // 🌑 Dark Mode with Green Contrast
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB' }), // CartoDB Positron (Soft Pastel)
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap HOT' }), // 🌿 OSM HOT (Bright Green Areas)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }), // 🛰️ Esri World Imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }), // 🏔️ Esri World Topographic
    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', { ttribution: '© <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> © <a href="https://stamen.com/" target="_blank">Stamen Design</a>',})


];


let currentLayerIndex = 0; // Track which layer is active

// 🚀 Initialize map with the first layer
let map = L.map('map', {
    center: [19.0760, 72.8777], // Mumbai Coordinates
    zoom: 11,
    layers: [layers[currentLayerIndex]]
});

// 🌍 Function to switch layers on button click
window.toggleMapLayer = function () {
    map.removeLayer(layers[currentLayerIndex]); // Remove the current base layer
    currentLayerIndex = (currentLayerIndex + 1) % layers.length; // Cycle to the next layer
    map.addLayer(layers[currentLayerIndex]); // Add the new layer
};


let markers = {};
let zoomThreshold = 12; // Adjust as needed

let clickMarker; // Store the marker so we can update it

document.addEventListener("DOMContentLoaded", loadPokedex);

window.setupPokemonSuggestions = function (inputFieldId, suggestionsListId) {
    loadPokemonList().then(pokemonList => {
        let inputField = document.getElementById(inputFieldId);
        let suggestionsList = document.getElementById(suggestionsListId);

        if (!inputField || !suggestionsList) return;

        inputField.addEventListener("input", () => {
            let search = inputField.value.toLowerCase();
            suggestionsList.innerHTML = "";

            if (!search) {
                suggestionsList.style.display = "none";
                return;
            }

            let filtered = pokemonList.filter(pokemon =>
                pokemon.toLowerCase().includes(search)
            );

            filtered.slice(0, 5).forEach(pokemon => {
                let li = document.createElement("li");
                li.textContent = pokemon;
                li.addEventListener("click", () => {
                    inputField.value = pokemon;
                    suggestionsList.style.display = "none";
                });
                suggestionsList.appendChild(li);
            });

            suggestionsList.style.display = filtered.length ? "block" : "none";
        });
    });
};

window.validatePokemonName = async function (pokemonInput) {
    if (!pokemonInput) {
        window.showToast("❌ Please enter a Pokémon name.");
        return null;
    }

    const pokemonList = await loadPokemonList();
    let validPokemon = pokemonList.map(p => p.toLowerCase());
    let matchedPokemon = validPokemon.find(p => p === pokemonInput.toLowerCase());

    if (!matchedPokemon) {
        window.showToast("❌ Invalid Pokémon name! Please select from the list.");
        return null;
    }

    return pokemonList[validPokemon.indexOf(matchedPokemon)]; // Return the correctly formatted name
};


async function fetchLocationName(lat, lng, zoom) {
    try {
        let response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}`);
        let data = await response.json();

        if (!data.address) return "Unknown Location";

        // Adjust place name based on zoom level
        if (zoom >= 15) {
            return data.display_name; // Street Level
        } else if (zoom >= 12) {
            return data.address.suburb || data.address.town || data.address.city || "Unknown Area"; // Suburb Level
        } else {
            return data.address.city || data.address.state || data.address.country || "Unknown Region"; // City/State Level
        }
    } catch (error) {
        console.error("Error fetching place name:", error);
        return "Unknown Location";
    }
}

window.showNestPopup = function(lat, lng) {
    if (tempMarker) {
        map.removeLayer(tempMarker); // Remove previous temp marker if exists
    }

    // ✅ Create an invisible marker to store lat/lng
    tempMarker = L.marker([lat, lng], { opacity: 0 }) // Hidden marker
        .addTo(map);

    // ✅ Create a popup at the clicked location
    const popup = L.popup({ offset: [0, 0] })
        .setLatLng([lat, lng])
        .setContent(`
            <div class="nest-popup">
                <input type="text" id="tempPokemon" placeholder="Enter Pokémon Name">
                <ul id="pokemonSuggestions" class="suggestions-list"></ul>
                <button class="gmaps-btn" onclick="confirmNest()">✔️ Add&nbsp;</button>
            </div>
        `)
        .openOn(map); // Opens directly on the map

    // ✅ Attach Pokémon name suggestions
    setTimeout(() => setupPokemonSuggestions("tempPokemon", "pokemonSuggestions"), 100);
};


let lastTapTime = 0;
let tapTimeout;
let isMarkerVisible = false; // Track marker visibility

map.on('click', async function (event) {
    if (placingMarker) return; // 🚫 Skip if placeMarker is active

    const currentTapTime = Date.now();
    const tapGap = currentTapTime - lastTapTime;
    lastTapTime = currentTapTime;

    // 🚫 If it's a double tap, cancel the marker placement
    if (tapGap < 500) {
        clearTimeout(tapTimeout);
        return;
    }

    // Toggle marker: If marker exists, remove it; if not, place it
    if (isMarkerVisible) {
        if (clickMarker) {
            map.removeLayer(clickMarker);
            clickMarker = null; // Reset marker
        }
        isMarkerVisible = false;
    } else {
        // Use timeout to delay marker placement (to check for double taps)
        tapTimeout = setTimeout(async () => {
            if (clickMarker) {
                map.removeLayer(clickMarker);
            }

            const { lat, lng } = event.latlng;
            const fullPlaceName = await fetchLocationName(lat, lng, map.getZoom());
            let [mainTitle, ...addressParts] = fullPlaceName.split(',');
            let address = addressParts.join(',').trim();

            const asciiMarker = L.divIcon({
                className: "ascii-marker",
                html: `<div style="
                    font-size: 25px; 
                    font-weight: bold;
                    color: gray; 
                    padding: 4px; 
                    border: none;
                ">🚩</div>`,  // Replace "★" with any ASCII symbol or text
                iconSize: [25, 25],
                iconAnchor: [12, 12], // Adjust position
                popupAnchor: [2, -5],
            });

            // Create a new marker with popup
            clickMarker = L.marker([lat, lng], {icon: asciiMarker})
                .addTo(map)
                .bindPopup(
                    `<div class="popup-container">
                        <b class="popup-title">${mainTitle}</b>
                        <p class="popup-address">${address}</p>
                        <div class="popup-actions">
                            <button class="copy-btn" onclick="copyToClipboard('${lat.toFixed(5)}, ${lng.toFixed(5)}')">
                                &nbsp;${lat.toFixed(5)}, ${lng.toFixed(5)}&nbsp;
                            </button>
                            <button class="gmaps-btn" onclick="openGoogleMaps(${lat}, ${lng})" title="Open in Google Maps">🗺️</button>
                            <button class="gmaps-btn" onclick="showNestPopup(${lat}, ${lng})" title="Add Pokémon Nest">➕</button>
                        </div>
                    </div>`
                )
                .openPopup();

            isMarkerVisible = true;
        }, 400); // Delay to check for double taps
    }
});



window.showToast = function (message) {
    let toast = document.createElement("div");
    toast.className = "toast-message";
    toast.innerText = message;
    document.body.appendChild(toast);

    // Remove toast after 2 seconds
    setTimeout(() => {
        toast.style.opacity = "0"; // Fade out
        setTimeout(() => toast.remove(), 300); // Remove from DOM after fading
    }, 2000);
};

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        window.showToast("Coordinates copied: " + text);
    }).catch(err => {
        console.error("Failed to copy: ", err);
    });
};

window.openGoogleMaps = function (lat, lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
};


function formatTimestamp(timestamp) {
    if (!timestamp) return "Unknown";

    let now = new Date();
    let time = new Date(timestamp * 1000); // Convert seconds to milliseconds
    let diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return "Just Now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}hr ${Math.floor((diffInSeconds % 3600) / 60)}min ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ${Math.floor((diffInSeconds % 86400) / 3600)}hr ago`;

    let weeks = Math.floor(diffInSeconds / 604800);
    let days = Math.floor((diffInSeconds % 604800) / 86400);
    let hours = Math.floor((diffInSeconds % 86400) / 3600);

    return `Last updated ${weeks}w ${days}d ${hours}hr ago`;
}

// On Zoom View out labels ger removed so reposition them as it is when zoom in
map.on("zoomend", function () {
    Object.values(markers).forEach((entry) => {
        if (entry.marker instanceof L.Marker) {
            // console.log("This is an L.Marker");

            var markerLatLng = entry.marker.getLatLng();

            // Reposition label if available
            if (entry.label) {
                // console.log("Found label, repositioning...");
                entry.label.setLatLng(markerLatLng);

                // Ensure label is rendered before modifying
                if (entry.label._icon) {
                    // Adjust z-index to keep label above markers
                    entry.label._icon.style.zIndex = "1000";
                } else {
                    // console.warn("Label _icon not found, forcing re-add...");
                    // map.removeLayer(entry.label);
                    entry.label.addTo(map);
                }
            }
        } else {
            console.log("This is NOT an L.Marker");
        }
    });
});





// Function to add a marker
function addMarker(lat, lng, pokemon, id, updatedAt = null) {
    if (markers[id]) return; // Prevent duplicate markers

    let dexNumber = pokedexMap[pokemon.toLowerCase()];

    let iconUrl = dexNumber
        ? `https://raw.githubusercontent.com/avy0010/PokemonGo/refs/heads/main/icons/webp/${dexNumber}_${pokemon}.webp`
        : "https://raw.githubusercontent.com/avy0010/PokemonGo/refs/heads/main/icons/0000_Unknown.webp"; // Default image if not found

    // ✅ Create a Leaflet icon with the Pokémon image
    let pokemonIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [60, 60],  // Bigger marker
        iconAnchor: [30, 40],  // Centers the marker
        popupAnchor: [0, -15]  // Popups open above the marker
    });

    let textWidth = pokemon.length * 7; // Approximate width based on characters
    let labelIcon = L.divIcon({
        className: "pokemon-name-label",
        html: `<span>${pokemon}</span>`, // Just the Pokémon name
        iconAnchor: [textWidth / 0.7, 20]  // Keeps it 2px away, auto-adjusts width
    });

    // ✅ Add the label after, so it stays below the marker
    let label = L.marker([lat, lng], { icon: labelIcon, interactive: false }).addTo(map).setZIndexOffset(-1000);;

    // ✅ Add the marker first so it appears on top
    let marker = L.marker([lat, lng], { icon: pokemonIcon })
        .bindPopup(`
            <div class="popup-container">
                <b class="popup-title">${pokemon}</b>
                <button class="gmaps-btn" onclick="deleteNest('${id}')" title="Delete Nest">🗑️</button>
                <button class="gmaps-btn" onclick="updateNest('${id}', '${pokemon}')" title="Update pokemon">✏️</button>
                <button class="gmaps-btn" onclick="openGoogleMaps(${lat}, ${lng})" title="Open in Google Maps">🗺️</button>
                <button class="copy-btn" onclick="copyToClipboard('${lat.toFixed(5)}, ${lng.toFixed(5)}')" title="Copy coordinates">📎</button>
                <br>
                <small>Last updated: ${formatTimestamp(updatedAt)}</small>
                
            </div>
        `).addTo(map);



    // ✅ Store both marker and label
    markers[id] = { marker, label };
}



// Function to remove a marker
function removeMarker(id) {
    if (markers[id]) {
        let markerObj = markers[id];

        // Remove from map
        if (map.hasLayer(markerObj.marker)) {
            map.removeLayer(markerObj.marker);
        }
        if (map.hasLayer(markerObj.label)) {
            map.removeLayer(markerObj.label);
        }

        // Manually remove from DOM
        let markerEl = document.querySelector(".leaflet-marker-icon.leaflet-interactive");
        if (markerEl) markerEl.remove();

        // Disable dragging
        if (markerObj.marker.dragging) {
            markerObj.marker.dragging.disable();
        }

        // Delete from object
        delete markers[id];
    }
}



// Function to update visibility based on zoom
function updateMarkerVisibility() {
    let zoom = map.getZoom();
    Object.values(markers).forEach(({ marker, label }) => {
        if (zoom >= zoomThreshold) {
            marker.addTo(map);
            label.addTo(map);
        } else {
            map.removeLayer(marker);
            map.removeLayer(label);
        }
    });
}

// Attach zoom event
map.on('zoomend', updateMarkerVisibility);


let userMarker = null; // Store user location marker

window.showCurrentLocation = function () {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;

            // Remove previous marker if it exists
            if (userMarker) {
                map.removeLayer(userMarker);
            }

            // Create ASCII marker
            const asciiMarker = L.divIcon({
                className: "ascii-marker",
                html: `<div style="
                    font-size: 40px; 
                    padding: 4px;
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
                ">🧍‍♀️</div>`, // Unicode pin or any ASCII character
                iconSize: [25, 25],
                iconAnchor: [12, 12], // Adjust position
                popupAnchor: [20, -5],
            });

            // Add marker at the user's location
            userMarker = L.marker([lat, lng], { icon: asciiMarker }).addTo(map)
                .bindPopup('<p style="color: #585858;font-size:14px;font-weight:bold">You are here!</p>').openPopup();


            // Move the map view to the user's location
            map.setView([lat, lng], 15);
        },
        (error) => {
            alert("Unable to retrieve your location. Make sure location services are enabled.");
            console.error("Geolocation error:", error);
        }
    );
};


// Attach event listener to the "Locate Me" button
document.getElementById("locate-btn").addEventListener("click", showCurrentLocation);


let tempMarker = null; // Store temporary marker
let placingMarker = false; // 🚀 Track if the user is placing a marker

window.placeMarker = async function () {
    window.showToast("Click on the map to place a marker!");

    placingMarker = true;
    document.getElementById("map").classList.add("map-marker-cursor");

    map.once('click', async function (e) {
        let lat = e.latlng.lat;
        let lng = e.latlng.lng;

        if (tempMarker) {
            map.removeLayer(tempMarker);
        }

        // ✅ ASCII or Emoji Marker (Replace "★" with any symbol you want)
        let asciiMarker = L.divIcon({
            className: "ascii-marker",
            html: `<div style="
            font-size: 30px; 
            font-weight: bold;
            color: #16C47F; 
            padding: 4px;
            border: none;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
            ">📍</div>`,
            iconSize: [25, 25],
            iconAnchor: [12, 12],
            popupAnchor: [13, -5],
        });

        // ✅ Create marker using ASCII icon
        tempMarker = L.marker([lat, lng], { 
            draggable: true, 
            icon: asciiMarker
        }).addTo(map)
        .bindPopup(`
            <input type="text" id="tempPokemon" placeholder="Enter Pokémon Name">
            <ul id="pokemonSuggestions" class="suggestions-list"></ul>
            <button class="gmaps-btn" onclick="confirmNest()">✔️ Add&nbsp;</button>
        `)
        .openPopup();

        // ✅ Attach Pokémon suggestions
        setupPokemonSuggestions("tempPokemon", "pokemonSuggestions");

        // ✅ Reattach popup & suggestions after dragging
        tempMarker.on("dragend", function () {
            tempMarker.openPopup();
            setTimeout(() => setupPokemonSuggestions("tempPokemon", "pokemonSuggestions"), 100);
        });

        document.getElementById("map").classList.remove("map-marker-cursor");

        setTimeout(() => {
            placingMarker = false;
        }, 500);
    });
};





window.confirmNest = async function () {
    let pokemonInput = document.getElementById("tempPokemon").value.trim();
    let correctPokemonName = await validatePokemonName(pokemonInput);
    if (!correctPokemonName) return; // Stop if invalid

    let lat = tempMarker.getLatLng().lat;
    let lng = tempMarker.getLatLng().lng;
    let docId = `${lat}_${lng}`.replace(/\./g, "_");

    try {
        await setDoc(doc(db, "pokemon_nests", docId), {
            location: new GeoPoint(lat, lng),
            addedAt: serverTimestamp(),
            pokemon: correctPokemonName
        }, { merge: true });

        console.log("✅ Nest added:", docId);
        window.showToast("✅ Nest added successfully!");

        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }

        let docSnap = await getDoc(doc(db, "pokemon_nests", docId));
        if (docSnap.exists()) {
            let nest = docSnap.data();

            let popupContent = `
                <b>${nest.pokemon}</b>
                <button onclick="deleteNest('${docId}')" style="border:none; background:none; cursor:pointer;">🗑️</button>
                <button onclick="updateNest('${docId}', '${nest.pokemon}')" style="border:none; background:none; cursor:pointer;">✏️</button>
                <br>
                <small>Last updated: ${formatTimestamp(nest.addedAt?.seconds)}</small>
            `;

            let standalonePopup = L.popup({ offset: [0,-8] })
                .setLatLng([lat, lng])
                .setContent(popupContent)
                .openOn(map);

            setTimeout(() => {
                map.closePopup(standalonePopup);
            }, 4000);
        }

    } catch (error) {
        console.error("❌ Error adding/updating nest:", error);
    }
};


window.updateNest = async function (id, oldPokemon) {
    let docSnap = await getDoc(doc(db, "pokemon_nests", id));
    if (!docSnap.exists()) {
        window.showToast("❌ Nest not found.");
        return;
    }

    let nest = docSnap.data();
    let popupLatLng = [nest.location.latitude, nest.location.longitude];

    let popupContent = `
        <input type="text" id="updatePokemon" placeholder="Enter Pokémon Name" value="${oldPokemon}">
        <ul id="updateSuggestions" class="suggestions-list"></ul>
        <button  class="gmaps-btn" onclick="confirmUpdate('${id}')">✔️ Update</button>
    `;

    let popup = L.popup({ offset: [0,-8] })
        .setLatLng(popupLatLng)
        .setContent(popupContent)
        .openOn(map);

    // ✅ Auto-focus and listen for "Enter" key
    setTimeout(() => {
        let input = document.getElementById("updatePokemon");
        input.focus();
        input.value = ""; 
        input.value = oldPokemon;
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") confirmUpdate(id);
        });
        setupPokemonSuggestions("updatePokemon", "updateSuggestions");
    }, 100);
};

window.confirmUpdate = async function (id) {
    let pokemonInput = document.getElementById("updatePokemon").value.trim();
    let correctPokemonName = await validatePokemonName(pokemonInput);
    if (!correctPokemonName) return; // Stop if invalid

    // 🔹 Fetch existing Pokémon name
    let docSnap = await getDoc(doc(db, "pokemon_nests", id));
    if (docSnap.exists()) {
        let currentPokemon = docSnap.data().pokemon;
        
        // 🔸 If the Pokémon is the same, skip update
        if (correctPokemonName.toLowerCase() === currentPokemon.toLowerCase()) {
            window.showToast("⚠️ No changes detected. Pokémon is already the same.");
            return;
        }
    }

    try {
        await setDoc(doc(db, "pokemon_nests", id), {
            pokemon: correctPokemonName,
            addedAt: serverTimestamp()
        }, { merge: true });

        console.log("✅ Nest updated:", id);
        window.showToast(`✅ Pokémon updated to ${correctPokemonName}!`);

        if (docSnap.exists()) updatePopup(id, docSnap.data());

    } catch (error) {
        console.error("❌ Error updating nest:", error);
        window.showToast("❌ Error updating Pokémon. Try again!");
    }
};


window.updatePopup = function (id, nest) {
    let popupContent = `
        <b>${nest.pokemon}</b>
        <button onclick="deleteNest('${id}')" style="border:none; background:none; cursor:pointer;">🗑️</button>
        <button onclick="updateNest('${id}', '${nest.pokemon}')" style="border:none; background:none; cursor:pointer;">✏️</button>
        <br>
        <small>Last updated: ${formatTimestamp(nest.addedAt?.seconds)}</small>
    `;

    let popupLatLng = [nest.location.latitude, nest.location.longitude];

    let standalonePopup = L.popup({ offset: [0,-8] })
        .setLatLng(popupLatLng)
        .setContent(popupContent)
        .openOn(map);

    setTimeout(() => {
        map.closePopup(standalonePopup);
    }, 4000);
};

window.deleteNest = async function (id) {
    let docSnap = await getDoc(doc(db, "pokemon_nests", id));
    if (!docSnap.exists()) {
        window.showToast("❌ Nest not found.");
        return;
    }

    let nest = docSnap.data();
    let correctPokemonName = nest.pokemon; // Case-sensitive original name
    let popupLatLng = [nest.location.latitude, nest.location.longitude];

    let popupContent = `
        <p>Type <b>${correctPokemonName}</b> to confirm deletion:</p>
        <input type="text" id="deletePokemonInput" placeholder="Enter Pokémon Name" onkeydown="handleDeleteKey(event, '${id}', '${correctPokemonName}')">
        <button class="gmaps-btn" onclick="confirmDelete('${id}', '${correctPokemonName}')">🗑️ Delete&nbsp;</button>
    `;

    let popup = L.popup({ offset: [0,-8] })
        .setLatLng(popupLatLng)
        .setContent(popupContent)
        .openOn(map);

    // Auto-focus on input when popup opens
    setTimeout(() => document.getElementById("deletePokemonInput").focus(), 100);
};

// ✅ Function to handle Enter key
window.handleDeleteKey = function (event, id, correctPokemonName) {
    if (event.key === "Enter") {
        confirmDelete(id, correctPokemonName);
    }
};

// ✅ Function to confirm deletion
window.confirmDelete = async function (id, correctPokemonName) {
    let userInput = document.getElementById("deletePokemonInput").value.trim();

    if (userInput.toLowerCase() !== correctPokemonName.toLowerCase()) {
        window.showToast("❌ Incorrect Pokémon name. Deletion cancelled.");
        return;
    }

    try {
        await deleteDoc(doc(db, "pokemon_nests", id)); // Delete from Firestore
        removeMarker(id); // Instantly remove from map
        map.closePopup(); // ✅ Close the popup after deletion
        window.showToast(`✅ ${correctPokemonName} nest deleted successfully!`);
    } catch (error) {
        console.error("❌ Error deleting nest:", error);
        window.showToast("❌ Error deleting nest. Try again!");
    }
};



// Function to show nest info
window.showNestInfo = async function (id) {
    let docSnap = await getDoc(doc(db, "pokemon_nests", id));
    if (docSnap.exists()) {
        let data = docSnap.data();
        alert(`Pokémon: ${data.pokemon}\nLast Updated: ${data.updatedAt?.toDate()}`);
    } else {
        alert("Nest info not found.");
    }
};


let searchTimeout; // For debouncing input

document.getElementById("searchPlace").addEventListener("input", function () {
    clearTimeout(searchTimeout); // Reset timeout on every keystroke
    searchTimeout = setTimeout(() => searchPlaces(), 300); // Wait 300ms before searching
});

window.searchPlaces = async function () {
    let query = document.getElementById("searchPlace").value.trim();
    let resultList = document.getElementById("placeResults");

    if (query.length < 3) {
        resultList.style.opacity = "0"; // Hide results smoothly
        return;
    }

    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`;

    try {
        console.log("🔍 Fetching:", url);
        let response = await fetch(url);
        let data = await response.json();
        console.log("🌍 API Response:", data);

        resultList.innerHTML = ""; // Clear old results

        if (!data || data.length === 0) {
            resultList.innerHTML = "<li>No places found.</li>";
        } else {
            data.forEach(place => {
                let listItem = document.createElement("li");
                listItem.textContent = place.display_name;
                listItem.addEventListener("click", function () {
                    document.getElementById("searchPlace").value = place.display_name;
                    map.setView([place.lat, place.lon], 15);
                    resultList.innerHTML = ""; // ✅ Hide results after selection
                });
                resultList.appendChild(listItem);
            });
        }

        resultList.style.opacity = "1"; // Show results smoothly
    } catch (error) {
        console.error("❌ Error fetching places:", error);
        resultList.innerHTML = "<li>Error fetching places.</li>";
    }
};


// 🔹 Hide results when clicking outside
document.addEventListener("click", function (event) {
    let searchBox = document.getElementById("searchPlace");
    let resultList = document.getElementById("placeResults");

    if (!searchBox.contains(event.target) && !resultList.contains(event.target)) {
        resultList.innerHTML = ""; // ✅ Clears results when clicking outside
        // resultList.style.display = "none";
    }
});


// Search by Pokémon function
window.searchNests = async function () {
    if (!allNests.length) {
        console.log("❌ No nests loaded yet!");
        return;
    }

    let searchQuery = document.getElementById("searchPokemon").value.trim().toLowerCase();

    // ✅ Validate the Pokémon name
    const pokemonList = await loadPokemonList();
    let validPokemon = pokemonList.map(p => p.toLowerCase());

    if (!validPokemon.includes(searchQuery) && searchQuery !== "*" && searchQuery !== "") {
        window.showToast("❌ Invalid Pokémon name! Please select from the list.");
        return;
    }

    // If search query is "*", show all nests
    let results = searchQuery === "*"
        ? allNests
        : allNests.filter(nest => nest.pokemon.toLowerCase().includes(searchQuery));

    let resultList = document.getElementById("searchResults");
    resultList.innerHTML = "";

    if (results.length === 0) {
        resultList.innerHTML = "<li>No nests found.</li>";
        return;
    }

    for (let nest of results) {
        let placeName = await getPlaceName(nest.location.latitude, nest.location.longitude);

        let listItem = document.createElement("li");
        listItem.innerHTML = `${nest.pokemon} - ${placeName}`;

        listItem.addEventListener("click", function () {
            map.setView([nest.location.latitude, nest.location.longitude], 15);
        });

        resultList.appendChild(listItem);
    }
};

// ✅ Attach Pokémon suggestions to search input on page load
document.addEventListener("DOMContentLoaded", () => {
    setupPokemonSuggestions("searchPokemon", "searchSuggestions");

    // ✅ Listen for Enter key in search input
    document.getElementById("searchPokemon").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent form submission or page refresh
            searchNests(); // Call search function
        }
    });
});





// 🔹 Hide results when clicking outside
document.addEventListener("click", function (event) {
    let searchBox = document.getElementById("searchPokemon");
    let resultList = document.getElementById("searchResults");

    if (!searchBox.contains(event.target) && !resultList.contains(event.target)) {
        resultList.innerHTML = ""; // ✅ Clears results when clicking outside
        // resultList.style.display = "none";
    }
});



window.searchPlaces = async function () {
    let query = document.getElementById("searchPlace").value.trim();
    let resultList = document.getElementById("placeResults");
    resultList.innerHTML = "";

    let isCoordinates = query.match(/^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/);
    if (isCoordinates) {
        let [lat, lng] = query.split(/,\s*/).map(Number);
        let placeName = await getPlaceName(lat, lng);
        resultList.innerHTML = `<li> ${placeName}</li>`;
        map.setView([lat, lng], 15);
        return;
    }

    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;
    try {
        let response = await fetch(url);
        let data = await response.json();
        if (data.length === 0) {
            resultList.innerHTML = "<li>No places found.</li>";
            return;
        }
        data.forEach(place => {
            let listItem = document.createElement("li");
            listItem.innerHTML = `${place.display_name}`;
            listItem.addEventListener("click", function () {
                map.setView([place.lat, place.lon], 15);
            });
            resultList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error fetching place data:", error);
        resultList.innerHTML = "<li>Error fetching places.</li>";
    }
};



async function getPlaceName(lat, lng) {
    let url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    try {
        let response = await fetch(url);
        let data = await response.json();
        return data.display_name || "Unknown Location"; // Return place name or default
    } catch (error) {
        console.error("Error fetching place name:", error);
        return "Unknown Location";
    }
}

// search place name 

let allNests = [];
// let markers = {}; // Store marker references

async function loadNests() {
    onSnapshot(collection(db, "pokemon_nests"), (snapshot) => {
        allNests = []; // Clear previous data

        // 🛠️ Remove all markers before reloading
        Object.keys(markers).forEach(id => removeMarker(id));

        snapshot.forEach(doc => {
            let nest = doc.data();
            let id = doc.id;
            allNests.push({ id, ...nest });

            // 🛠️ Add marker for each nest
            if (nest.location) {
                addMarker(nest.location.latitude, nest.location.longitude, nest.pokemon, id, nest.addedAt?.seconds || null);
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", loadNests);

window.openTab = function (event, tabId) {
    // Hide all tab panels
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.remove("active");
    });

    // Deactivate all tab buttons
    document.querySelectorAll(".tab-btn").forEach(button => {
        button.classList.remove("active");
    });

    // Show selected tab content
    document.getElementById(tabId).classList.add("active");

    // Activate clicked button
    event.currentTarget.classList.add("active");
};

// Ensure first tab is active on page load
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".gmaps-btn").classList.add("active");
    document.querySelector(".tab-panel").classList.add("active");

});

window.toggleTabs = function () {
    const tabsContainer = document.querySelector('.tabs-container');

    if (tabsContainer) {
        if (tabsContainer.style.maxHeight === '0px' || !tabsContainer.style.maxHeight) {
            tabsContainer.style.maxHeight = tabsContainer.scrollHeight + 'px';
        } else {
            tabsContainer.style.maxHeight = '0px';
        }
    }
};


document.getElementById("toggleTabsBtn").addEventListener("click", function () {
    const tabsContainer = document.getElementById("tabsContainer");
    tabsContainer.classList.toggle("hidden"); // Toggle visibility
});

