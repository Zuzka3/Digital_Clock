// Import potřebných modulů
const express = require('express');
const axios = require('axios');     
const path = require('path');       

const app = express();
const PORT = process.env.PORT || 3000;

// --- Konfigurace ---

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'c54275f416644175883172628240111';
const IPINFO_API_KEY = process.env.IPINFO_API_KEY || 'c2a2c192fbe6d2';       

if (!WEATHER_API_KEY || !IPINFO_API_KEY) {
    console.error("KRITICKÁ CHYBA: Chybí API klíč pro WeatherAPI nebo IPinfo. Nastavte proměnné prostředí nebo je zadejte přímo v server.js.");
    process.exit(1); 
}

// --- Middleware ---
// Nastavení servírování statických souborů (HTML, CSS, JS) ze složky 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Routy (pravidla zpracování URL) ---
// Hlavní routa pro servírování HTML stránky
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint pro získání dat o počasí
app.get('/api/weather', async (req, res) => {
    let query = req.query.q;
    let locationSource = 'query parameter'; 
    let finalQuery = query;

    try {
        if (!finalQuery) {
            locationSource = 'IP adresa';
            finalQuery = await getLocationFromIP();
        }

        const weather = await getWeatherFromAPI(finalQuery);

        const returnedCityName = weather.location?.name || finalQuery.split(',')[0];

        res.json({
            city: returnedCityName, 
            temp: weather.current.temp_c, 
            description: weather.current.condition.text, 
            icon: weather.current.condition.icon, 
            wind_speed: weather.current.wind_kph,
            humidity: weather.current.humidity,
            forecast: weather.forecast.forecastday || []
        });

    } catch (error) {
        console.error(`Chyba při zpracování /api/weather pro dotaz "${finalQuery || '(podle IP)'}" (Zdroj: ${locationSource}):`, error.message);

        res.status(500).json({
            error: `Chyba při načítání počasí pro ${finalQuery ? `"${finalQuery}"` : 'vaši lokaci'}.`,
            details: error.message
        });
    }
});

// --- Pomocné funkce ---

// Asynchronní funkce pro získání přibližné lokace (města) z IP adresy pomocí ipinfo.io
async function getLocationFromIP() {
    const url = `https://ipinfo.io?token=${IPINFO_API_KEY}`; 
    try {
        const response = await axios.get(url);
        const city = response.data?.city; 
        if (!city) {
            throw new Error("API ipinfo.io nevrátilo název města.");
        }
        return city;
    } catch (error) {
        console.error("Chyba při získávání IP lokace z ipinfo.io:", error.response?.data || error.message);
        console.warn("Používá se výchozí lokace 'Praha' kvůli chybě při zjišťování IP.");
        return 'Prague'; 
    }
}

// Asynchronní funkce pro získání dat o počasí z WeatherAPI.com
async function getWeatherFromAPI(query) {
    if (!query) {
        throw new Error("Dotaz (město nebo lat,lon) je vyžadován pro získání počasí.");
    }
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=7&aqi=no&alerts=no&lang=cz`;

    try {
        const response = await axios.get(url); 
        if (!response.data || !response.data.current || !response.data.location || !response.data.forecast?.forecastday) {
            console.error("Z WeatherAPI byla přijata nekompletní data pro dotaz:", query, response.data);
            throw new Error("Nekompletní nebo neočekávaná odpověď z Weather API.");
        }
        return response.data;
    } catch (error) {
        const apiErrorMessage = error.response?.data?.error?.message;
        const errorMessage = apiErrorMessage || error.message || 'Neznámá chyba při komunikaci s Weather API';
        throw new Error(`Chyba Weather API: ${errorMessage}`);
    }
}

// --- Spuštění serveru ---
app.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
});