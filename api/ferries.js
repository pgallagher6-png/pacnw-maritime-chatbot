// api/ferries.js - Phase 1: 5 Major Routes
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Parse route from query or message
    const routeQuery = req.query.route || req.query.q || 'seattle-bainbridge';
    const direction = req.query.direction || 'auto';
    
    // AI route detection from natural language
    const detectedRoute = parseRouteFromQuery(routeQuery);
    
    // Get current Pacific Time
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    // Generate ferry data for detected route
    const ferryInfo = generateFerryData(detectedRoute, pacificTime, direction);
    
    res.status(200).json(ferryInfo);
    
  } catch (error) {
    console.error('Ferry API error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch ferry data',
      message: error.message 
    });
  }
}

// Phase 1 Routes - Top 5 by ridership
const FERRY_ROUTES = {
  'seattle-bainbridge': {
    name: 'Seattle ↔ Bainbridge Island',
    shortName: 'Seattle-Bainbridge',
    terminals: {
      a: 'Seattle (Colman Dock)',
      b: 'Bainbridge Island'
    },
    crossingTime: 35,
    frequency: '35-50 minutes',
    reservations: false,
    category: 'major-commuter',
    vessels: ['WENATCHEE', 'SPOKANE', 'WALLA WALLA'],
    weekdaySchedule: {
      'seattle-to-bainbridge': [
        {hour: 5, minute: 20}, {hour: 6, minute: 25}, {hour: 7, minute: 55},
        {hour: 9, minute: 10}, {hour: 10, minute: 25}, {hour: 11, minute: 40},
        {hour: 12, minute: 55}, {hour: 14, minute: 10}, {hour: 15, minute: 25},
        {hour: 16, minute: 40}, {hour: 17, minute: 55}, {hour: 19, minute: 10},
        {hour: 20, minute: 25}, {hour: 21, minute: 40}, {hour: 22, minute: 55}
      ],
      'bainbridge-to-seattle': [
        {hour: 6, minute: 0}, {hour: 7, minute: 5}, {hour: 8, minute: 35},
        {hour: 9, minute: 50}, {hour: 11, minute: 5}, {hour: 12, minute: 20},
        {hour: 13, minute: 35}, {hour: 14, minute: 50}, {hour: 16, minute: 5},
        {hour: 17, minute: 20}, {hour: 18, minute: 35}, {hour: 19, minute: 50},
        {hour: 21, minute: 5}, {hour: 22, minute: 20}, {hour: 23, minute: 35}
      ]
    }
  },

  'edmonds-kingston': {
    name: 'Edmonds ↔ Kingston',
    shortName: 'Edmonds-Kingston',
    terminals: {
      a: 'Edmonds',
      b: 'Kingston'
    },
    crossingTime: 30,
    frequency: '40-50 minutes',
    reservations: false,
    category: 'major-commuter',
    vessels: ['CHIMACUM', 'KENNEWICK'],
    weekdaySchedule: {
      'edmonds-to-kingston': [
        {hour: 5, minute: 30}, {hour: 6, minute: 20}, {hour: 7, minute: 10},
        {hour: 8, minute: 0}, {hour: 8, minute: 50}, {hour: 9, minute: 40},
        {hour: 10, minute: 45}, {hour: 11, minute: 50}, {hour: 12, minute: 55},
        {hour: 14, minute: 0}, {hour: 15, minute: 5}, {hour: 16, minute: 10},
        {hour: 17, minute: 15}, {hour: 18, minute: 20}, {hour: 19, minute: 25},
        {hour: 20, minute: 35}, {hour: 21, minute: 45}, {hour: 23, minute: 0}
      ],
      'kingston-to-edmonds': [
        {hour: 6, minute: 5}, {hour: 6, minute: 55}, {hour: 7, minute: 45},
        {hour: 8, minute: 35}, {hour: 9, minute: 25}, {hour: 10, minute: 15},
        {hour: 11, minute: 20}, {hour: 12, minute: 25}, {hour: 13, minute: 30},
        {hour: 14, minute: 35}, {hour: 15, minute: 40}, {hour: 16, minute: 45},
        {hour: 17, minute: 50}, {hour: 18, minute: 55}, {hour: 20, minute: 0},
        {hour: 21, minute: 10}, {hour: 22, minute: 20}, {hour: 23, minute: 35}
      ]
    }
  },

  'mukilteo-clinton': {
    name: 'Mukilteo ↔ Clinton (Whidbey Island)',
    shortName: 'Mukilteo-Clinton',
    terminals: {
      a: 'Mukilteo',
      b: 'Clinton (Whidbey Island)'
    },
    crossingTime: 20,
    frequency: '30-40 minutes',
    reservations: false,
    category: 'frequent',
    vessels: ['MUKILTEO', 'COLUMBIA'],
    weekdaySchedule: {
      'mukilteo-to-clinton': [
        {hour: 5, minute: 0}, {hour: 5, minute: 30}, {hour: 6, minute: 0},
        {hour: 6, minute: 30}, {hour: 7, minute: 0}, {hour: 7, minute: 30},
        {hour: 8, minute: 0}, {hour: 8, minute: 30}, {hour: 9, minute: 15},
        {hour: 10, minute: 0}, {hour: 10, minute: 45}, {hour: 11, minute: 30},
        {hour: 12, minute: 15}, {hour: 13, minute: 0}, {hour: 13, minute: 45},
        {hour: 14, minute: 30}, {hour: 15, minute: 15}, {hour: 16, minute: 0},
        {hour: 16, minute: 45}, {hour: 17, minute: 30}, {hour: 18, minute: 15},
        {hour: 19, minute: 0}, {hour: 19, minute: 45}, {hour: 20, minute: 30},
        {hour: 21, minute: 15}, {hour: 22, minute: 0}, {hour: 22, minute: 45}
      ],
      'clinton-to-mukilteo': [
        {hour: 5, minute: 25}, {hour: 5, minute: 55}, {hour: 6, minute: 25},
        {hour: 6, minute: 55}, {hour: 7, minute: 25}, {hour: 7, minute: 55},
        {hour: 8, minute: 25}, {hour: 8, minute: 55}, {hour: 9, minute: 40},
        {hour: 10, minute: 25}, {hour: 11, minute: 10}, {hour: 11, minute: 55},
        {hour: 12, minute: 40}, {hour: 13, minute: 25}, {hour: 14, minute: 10},
        {hour: 14, minute: 55}, {hour: 15, minute: 40}, {hour: 16, minute: 25},
        {hour: 17, minute: 10}, {hour: 17, minute: 55}, {hour: 18, minute: 40},
        {hour: 19, minute: 25}, {hour: 20, minute: 10}, {hour: 20, minute: 55},
        {hour: 21, minute: 40}, {hour: 22, minute: 25}, {hour: 23, minute: 10}
      ]
    }
  },

  'seattle-bremerton': {
    name: 'Seattle ↔ Bremerton',
    shortName: 'Seattle-Bremerton',
    terminals: {
      a: 'Seattle (Colman Dock)',
      b: 'Bremerton'
    },
    crossingTime: 60,
    frequency: '60-90 minutes',
    reservations: false,
    category: 'long-haul',
    vessels: ['SEATTLE', 'WALLA WALLA'],
    weekdaySchedule: {
      'seattle-to-bremerton': [
        {hour: 6, minute: 20}, {hour: 8, minute: 25}, {hour: 10, minute: 30},
        {hour: 12, minute: 35}, {hour: 14, minute: 40}, {hour: 16, minute: 45},
        {hour: 18, minute: 50}, {hour: 21, minute: 15}
      ],
      'bremerton-to-seattle': [
        {hour: 5, minute: 15}, {hour: 7, minute: 20}, {hour: 9, minute: 25},
        {hour: 11, minute: 30}, {hour: 13, minute: 35}, {hour: 15, minute: 40},
        {hour: 17, minute: 45}, {hour: 20, minute: 10}
      ]
    }
  },

  'anacortes-san-juan': {
    name: 'Anacortes ↔ San Juan Islands',
    shortName: 'San Juan Islands',
    terminals: {
      a: 'Anacortes',
      b: 'Friday Harbor',
      c: 'Orcas Island',
      d: 'Lopez Island'
    },
    crossingTime: 75, // Variable depending on stops
    frequency: '2-4 departures daily',
    reservations: true,
    category: 'island-hopping',
    vessels: ['CHELAN', 'SAMISH', 'SALISH'],
    special: 'Island hopping route - reservations required',
    weekdaySchedule: {
      'anacortes-to-islands': [
        {hour: 7, minute: 10}, {hour: 11, minute: 45}, 
        {hour: 16, minute: 30}, {hour: 19, minute: 50}
      ],
      'islands-to-anacortes': [
        {hour: 6, minute: 0}, {hour: 9, minute: 30}, 
        {hour: 14, minute: 15}, {hour: 18, minute: 45}
      ]
    }
  }
};

// AI-powered route detection from natural language
function parseRouteFromQuery(query) {
  const q = query.toLowerCase();
  
  // Direct route matches
  if ((q.includes('seattle') && q.includes('bainbridge')) || q.includes('seattle-bainbridge')) {
    return 'seattle-bainbridge';
  }
  if ((q.includes('edmonds') && q.includes('kingston')) || q.includes('edmonds-kingston')) {
    return 'edmonds-kingston';
  }
  if ((q.includes('mukilteo') && (q.includes('clinton') || q.includes('whidbey'))) || q.includes('mukilteo-clinton')) {
    return 'mukilteo-clinton';
  }
  if ((q.includes('seattle') && q.includes('bremerton')) || q.includes('seattle-bremerton')) {
    return 'seattle-bremerton';
  }
  if (q.includes('anacortes') || q.includes('san juan') || q.includes('friday harbor') || q.includes('orcas') || q.includes('lopez')) {
    return 'anacortes-san-juan';
  }
  
  // Single terminal detection
  if (q.includes('bainbridge') && !q.includes('edmonds')) return 'seattle-bainbridge';
  if (q.includes('kingston')) return 'edmonds-kingston';
  if (q.includes('clinton') || q.includes('whidbey')) return 'mukilteo-clinton';
  if (q.includes('bremerton')) return 'seattle-bremerton';
  if (q.includes('islands') || q.includes('friday') || q.includes('orcas')) return 'anacortes-san-juan';
  
  // Default fallback
  return 'seattle-bainbridge';
}

function generateFerryData(routeId, currentTime, direction) {
  const route = FERRY_ROUTES[routeId];
  
  if (!route) {
    return {
      error: 'Route not found',
      availableRoutes: Object.keys(FERRY_ROUTES),
      suggestion: 'Try: seattle-bainbridge, edmonds-kingston, mukilteo-clinton'
    };
  }
  
  // Smart direction detection
  const smartDirection = detectSmartDirection(route, direction, currentTime);
  
  // Find next departures
  const departures = findNextDepartures(route, currentTime, smartDirection);
  
  return {
    route: route.name,
    shortName: route.shortName,
    routeId: routeId,
    direction: smartDirection,
    timestamp: new Date().toISOString(),
    service: {
      status: 'Normal Operations',
      crossingTime: `${route.crossingTime} minutes`,
      frequency: route.frequency,
      reservations: route.reservations ? 'Required - book at wsdot.wa.gov/ferries' : 'Walk-up service available',
      category: route.category,
      special: route.special || null
    },
    vessels: {
      active: generateActiveVessels(route, currentTime),
      nextDepartures: departures
    },
    terminals: getTerminalInfo(route, smartDirection),
    alerts: generateAlerts(route, currentTime),
    debug: {
      routeId: routeId,
      detectedDirection: smartDirection,
      dataSource: 'Embedded Schedule v1.0',
      currentTime: currentTime.toLocaleString()
    }
  };
}

function detectSmartDirection(route, requestedDirection, currentTime) {
  if (requestedDirection !== 'auto') {
    return requestedDirection;
  }
  
  const hour = currentTime.getHours();
  const terminals = route.terminals;
  
  // Smart commute detection
  if (hour >= 6 && hour <= 9) {
    // Morning commute - usually TO major cities/work centers
    if (route.category === 'major-commuter') {
      if (routeId === 'seattle-bainbridge') return 'bainbridge-to-seattle';
      if (routeId === 'edmonds-kingston') return 'kingston-to-edmonds';
      if (routeId === 'seattle-bremerton') return 'bremerton-to-seattle';
    }
  }
  
  if (hour >= 16 && hour <= 19) {
    // Evening commute - usually FROM major cities
    if (route.category === 'major-commuter') {
      if (routeId === 'seattle-bainbridge') return 'seattle-to-bainbridge';
      if (routeId === 'edmonds-kingston') return 'edmonds-to-kingston';
      if (routeId === 'seattle-bremerton') return 'seattle-to-bremerton';
    }
  }
  
  // Default to first terminal direction
  const firstTerminal = Object.keys(terminals)[0];
  const secondTerminal = Object.keys(terminals)[1];
  return `${firstTerminal}-to-${secondTerminal}`;
}

function findNextDepartures(route, currentTime, direction) {
  const schedule = route.weekdaySchedule[direction];
  
  if (!schedule) {
    return [{
      time: 'Schedule not available',
      vessel: 'Check WSDOT website',
      note: 'Complex routing - see wsdot.wa.gov/ferries'
    }];
  }
  
  const departures = [];
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  // Find next departures
  for (let i = 0; i < schedule.length; i++) {
    const dep = schedule[i];
    const depTime = new Date(currentTime);
    depTime.setHours(dep.hour, dep.minute, 0, 0);
    
    if (depTime > currentTime) {
      departures.push({
        time: depTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        vessel: route.vessels[departures.length % route.vessels.length],
        waitTime: Math.round((depTime - currentTime) / (1000 * 60)) // minutes
      });
      
      if (departures.length >= 4) break;
    }
  }
  
  // Add tomorrow's departures if needed
  if (departures.length < 4) {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (let i = 0; i < Math.min(schedule.length, 4 - departures.length); i++) {
      const dep = schedule[i];
      const depTime = new Date(tomorrow);
      depTime.setHours(dep.hour, dep.minute, 0, 0);
      
      departures.push({
        time: depTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }) + ' (tomorrow)',
        vessel: route.vessels[departures.length % route.vessels.length],
        waitTime: null
      });
    }
  }
  
  return departures;
}

function generateActiveVessels(route, currentTime) {
  return [
    {
      name: `M/V ${route.vessels[0]}`,
      location: `At ${Object.values(route.terminals)[0]}`,
      status: 'Loading passengers'
    },
    {
      name: `M/V ${route.vessels[1] || route.vessels[0]}`,
      location: `En route to ${Object.values(route.terminals)[1]}`,
      status: 'In transit'
    }
  ];
}

function getTerminalInfo(route, direction) {
  const terminals = route.terminals;
  const terminalNames = Object.values(terminals);
  
  return {
    departure: {
      name: terminalNames[0],
      facilities: 'Parking, restrooms, food service',
      address: 'See WSDOT website for directions'
    },
    arrival: {
      name: terminalNames[1],
      facilities: 'Parking, restrooms',
      address: 'See WSDOT website for directions'
    }
  };
}

function generateAlerts(route, currentTime) {
  const alerts = [];
  const hour = currentTime.getHours();
  const day = currentTime.getDay();
  
  if (day === 0 || day === 6) {
    alerts.push('Weekend schedule - reduced service frequency');
  }
  
  if (route.reservations) {
    alerts.push('⚠️ Reservations required - book at wsdot.wa.gov/ferries');
  }
  
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
    alerts.push('Peak hours - arrive early for vehicle loading');
  }
  
  if (route.category === 'island-hopping') {
    alerts.push('Multi-stop route - travel time varies by destination');
  }
  
  return alerts.length > 0 ? alerts : ['Normal operations'];
}
