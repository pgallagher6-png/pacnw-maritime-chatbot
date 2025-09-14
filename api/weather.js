// api/weather.js - Vercel Serverless Function
// This goes in /api/weather.js in your repository

export default async function handler(req, res) {
  // Enable CORS for your domains
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Puget Sound coordinates (Seattle area)
    const lat = 47.6062;
    const lon = -122.3321;
    
    // Get NOAA weather data
    const weatherResponse = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`
    );
    
    if (!weatherResponse.ok) {
      throw new Error('Weather service unavailable');
    }
    
    const weatherData = await weatherResponse.json();
    
    // Get current conditions from the gridpoint
    const gridX = weatherData.properties.gridX;
    const gridY = weatherData.properties.gridY;
    const gridId = weatherData.properties.gridId;
    
    const currentResponse = await fetch(
      `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}`
    );
    
    const currentData = await currentResponse.json();
    
    // Get marine forecast
    const forecastResponse = await fetch(
      weatherData.properties.forecast
    );
    
    const forecastData = await forecastResponse.json();
    
    // Parse and format maritime-relevant data
    const marineForecast = formatMaritimeWeather(currentData, forecastData);
    
    res.status(200).json(marineForecast);
    
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch weather data',
      message: error.message 
    });
  }
}

function formatMaritimeWeather(currentData, forecastData) {
  const current = currentData.properties;
  const forecast = forecastData.properties.periods[0];
  
  // Extract maritime-relevant data
  const windSpeed = current.windSpeed?.values?.[0]?.value || 'N/A';
  const windDirection = current.windDirection?.values?.[0]?.value || 'N/A';
  const temperature = current.temperature?.values?.[0]?.value || 'N/A';
  const humidity = current.relativeHumidity?.values?.[0]?.value || 'N/A';
  const pressure = current.barometricPressure?.values?.[0]?.value || 'N/A';
  const visibility = current.visibility?.values?.[0]?.value || 'N/A';
  
  // Convert wind direction from degrees to compass
  const windDir = convertWindDirection(windDirection);
  
  // Convert metric to imperial for maritime use
  const windSpeedKnots = windSpeed !== 'N/A' ? Math.round(windSpeed * 1.944) : 'N/A';
  const tempF = temperature !== 'N/A' ? Math.round((temperature * 9/5) + 32) : 'N/A';
  const visibilityNM = visibility !== 'N/A' ? Math.round(visibility / 1852 * 10) / 10 : 'N/A';
  const pressureInHg = pressure !== 'N/A' ? Math.round(pressure / 3386.39 * 100) / 100 : 'N/A';
  
  return {
    location: 'Puget Sound / Seattle Area',
    timestamp: new Date().toISOString(),
    conditions: {
      wind: `${windDir} ${windSpeedKnots} knots`,
      temperature: `${tempF}°F`,
      visibility: `${visibilityNM} nautical miles`,
      humidity: `${humidity}%`,
      pressure: `${pressureInHg}" Hg`,
      forecast: forecast.detailedForecast
    },
    maritime: {
      seaState: estimateSeaState(windSpeedKnots),
      smallCraftAdvisory: windSpeedKnots > 25,
      conditions: categorizeConditions(windSpeedKnots, visibilityNM)
    }
  };
}

function convertWindDirection(degrees) {
  if (degrees === 'N/A') return 'Variable';
  
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
  ];
  
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function estimateSeaState(windKnots) {
  if (windKnots === 'N/A') return 'Unknown';
  if (windKnots < 4) return 'Calm (0-1 ft)';
  if (windKnots < 7) return 'Light (1-2 ft)';
  if (windKnots < 11) return 'Moderate (2-3 ft)';
  if (windKnots < 17) return 'Choppy (3-5 ft)';
  if (windKnots < 22) return 'Rough (5-8 ft)';
  return 'Very Rough (8+ ft)';
}

function categorizeConditions(windKnots, visibility) {
  if (windKnots === 'N/A' || visibility === 'N/A') return 'Unknown';
  
  if (windKnots > 25 || visibility < 2) return 'Poor - Small craft advisory';
  if (windKnots > 15 || visibility < 5) return 'Fair - Use caution';
  return 'Good - Favorable conditions';
}
