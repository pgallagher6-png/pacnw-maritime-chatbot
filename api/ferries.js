// api/ferries.js - Working simplified version
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const requestedRoute = req.query.route || 'seattle-bainbridge';
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    const ferryData = getRouteData(requestedRoute, pacificTime);
    res.status(200).json(ferryData);
    
  } catch (error) {
    console.error('Ferry API error:', error);
    res.status(500).json({ 
      error: 'Ferry API failed',
      message: error.message
    });
  }
}

function getRouteData(routeId, currentTime) {
  // Simple route detection
  let selectedRoute = 'seattle-bainbridge';
  
  if (routeId.includes('mukilteo') || routeId.includes('clinton') || routeId.includes('whidbey')) {
    selectedRoute = 'mukilteo-clinton';
  } else if (routeId.includes('edmonds') || routeId.includes('kingston')) {
    selectedRoute = 'edmonds-kingston';
  } else if (routeId.includes('bremerton')) {
    selectedRoute = 'seattle-bremerton';
  } else if (routeId.includes('anacortes') || routeId.includes('san-juan')) {
    selectedRoute = 'anacortes-san-juan';
  }
  
  // Route data
  const routes = {
    'seattle-bainbridge': {
      name: 'Seattle ↔ Bainbridge Island',
      shortName: 'Seattle-Bainbridge',
      crossingTime: 35,
      frequency: '35-50 minutes',
      vessels: ['WENATCHEE', 'SPOKANE'],
      schedule: [
        {hour: 10, minute: 25}, {hour: 11, minute: 40}, {hour: 12, minute: 55},
        {hour: 14, minute: 10}, {hour: 15, minute: 25}, {hour: 16, minute: 40},
        {hour: 17, minute: 55}, {hour: 19, minute: 10}, {hour: 20, minute: 25}
      ]
    },
    'mukilteo-clinton': {
      name: 'Mukilteo ↔ Clinton (Whidbey Island)',
      shortName: 'Mukilteo-Clinton (Whidbey)',
      crossingTime: 20,
      frequency: '30-40 minutes',
      vessels: ['MUKILTEO', 'COLUMBIA'],
      schedule: [
        {hour: 11, minute: 30}, {hour: 12, minute: 15}, {hour: 13, minute: 0},
        {hour: 13, minute: 45}, {hour: 14, minute: 30}, {hour: 15, minute: 15},
        {hour: 16, minute: 0}, {hour: 16, minute: 45}, {hour: 17, minute: 30},
        {hour: 18, minute: 15}, {hour: 19, minute: 0}, {hour: 19, minute: 45}
      ]
    },
    'edmonds-kingston': {
      name: 'Edmonds ↔ Kingston',
      shortName: 'Edmonds-Kingston',
      crossingTime: 30,
      frequency: '40-50 minutes',
      vessels: ['CHIMACUM', 'KENNEWICK'],
      schedule: [
        {hour: 11, minute: 50}, {hour: 12, minute: 55}, {hour: 14, minute: 0},
        {hour: 15, minute: 5}, {hour: 16, minute: 10}, {hour: 17, minute: 15},
        {hour: 18, minute: 20}, {hour: 19, minute: 25}, {hour: 20, minute: 35}
      ]
    },
    'seattle-bremerton': {
      name: 'Seattle ↔ Bremerton',
      shortName: 'Seattle-Bremerton',
      crossingTime: 60,
      frequency: '60-90 minutes',
      vessels: ['SEATTLE', 'WALLA WALLA'],
      schedule: [
        {hour: 12, minute: 35}, {hour: 14, minute: 40}, {hour: 16, minute: 45},
        {hour: 18, minute: 50}, {hour: 21, minute: 15}
      ]
    },
    'anacortes-san-juan': {
      name: 'Anacortes ↔ San Juan Islands',
      shortName: 'San Juan Islands',
      crossingTime: 75,
      frequency: '2-4 departures daily',
      vessels: ['CHELAN', 'SAMISH'],
      reservations: true,
      schedule: [
        {hour: 16, minute: 30}, {hour: 19, minute: 50}
      ]
    }
  };
  
  const route = routes[selectedRoute];
  const departures = findDepartures(route.schedule, currentTime, route.vessels);
  
  return {
    route: route.name,
    shortName: route.shortName,
    routeId: selectedRoute,
    timestamp: new Date().toISOString(),
    service: {
      status: 'Normal Operations',
      crossingTime: `${route.crossingTime} minutes`,
      frequency: route.frequency,
      reservations: route.reservations ? 'Required - book at wsdot.wa.gov/ferries' : 'Walk-up service available'
    },
    vessels: {
      active: [
        {
          name: `M/V ${route.vessels[0]}`,
          location: `Loading at terminal`,
          status: 'Active'
        }
      ],
      nextDepartures: departures
    },
    terminals: {
      departure: { name: 'Departure Terminal' },
      arrival: { name: 'Arrival Terminal' }
    },
    alerts: ['Normal operations'],
    debug: {
      routeId: selectedRoute,
      dataSource: 'Simple Schedule',
      currentTime: currentTime.toLocaleString()
    }
  };
}

function findDepartures(schedule, currentTime, vessels) {
  const departures = [];
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  for (let i = 0; i < schedule.length; i++) {
    const dep = schedule[i];
    const depTime = new Date(currentTime);
    depTime.setHours(dep.hour, dep.minute, 0, 0);
    
    if (depTime > currentTime) {
      const waitMinutes = Math.round((depTime - currentTime) / (1000 * 60));
      
      departures.push({
        time: depTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        vessel: vessels[departures.length % vessels.length],
        waitTime: waitMinutes
      });
      
      if (departures.length >= 3) break;
    }
  }
  
  if (departures.length === 0) {
    departures.push({
      time: 'See WSDOT schedule',
      vessel: 'Check website',
      waitTime: null
    });
  }
  
  return departures;
}
