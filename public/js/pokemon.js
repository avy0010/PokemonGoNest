export async function loadPokemonList() {
    try {
        let response = await fetch("data/pokedex.json");
        let data = await response.json();

        // Convert JSON object into an array of Pokémon names
        // console.log(Object.values(data))
        return Object.values(data);
    } catch (error) {
        console.error("❌ Error loading Pokémon list:", error);
        return [];
    }
}


export let pokedexMap = {};

export async function loadPokedex() {
    try {
        let response = await fetch("data/pokedex.json"); // Adjust path if needed
        let data = await response.json();

        // Reverse the map: { "Bulbasaur": "0001", "Ivysaur": "0002", ... }
        Object.entries(data).forEach(([dex, name]) => {
            pokedexMap[name.toLowerCase()] = dex;
        });
    } catch (error) {
        console.error("❌ Error loading Pokédex:", error);
    }
}
