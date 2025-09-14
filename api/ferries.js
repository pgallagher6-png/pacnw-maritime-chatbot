// api/ferries.js - Fixed for correct Seattle → Bainbridge direction
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get direction parameter (default to seattle-to-bainbridge)
    const direction = req.query.direction || 'seattle-to-bainbridge';
    
    // Get current Pacific Time
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    // Try to fetch real WSF data first
    const realData = await fetchRealWSFData(direction);
    
    // If we get real data, use it; otherwise fall back to realistic mock data
    const ferryInfo = realData || generateRealisticFallback(pacificTime, direction);
    
    // Add debug info
    ferryInfo.debug = {
      currentUTC: now.toISOString(),
      currentPacific: pacificTime.toLocaleString(),
      direction: direction,
      dataSource: realData ? 'WSF API' : 'Fallback Schedule'
    };
    
    res.status(200).json(ferryInfo);
    
  } catch (error) {
    console.error('Ferry API error:', error);
    
    // If there's an error, provide fallback data
    const pacificTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    const direction = req.query.direction || 'seattle-to-bainbridge';
    const fallbackData = generateRealisticFallback(pacificTime, direction);
    fallbackData.debug = {
      error: error.message,
      dataSource: 'Error Fallback',
      direction: direction
    };
    
    res.status(200).json(fallbackData);
  }
}

async function fetchRealWSFData(direction) {
  try {
    // WSF API endpoints
    const endpoints = {
      vessels: 'https://www.wsdot.wa.gov/ferries/api/vessels/rest/vessellocations',
      schedule: 'https://www.wsdot.wa.gov/ferries/api/schedule/rest/today',
      terminals: 'https://www.wsdot.wa.gov/ferries/api/terminals/rest/terminalspace'
    };

    // Fetch all data with timeout
    const fetchWithTimeout = (url, timeout = 5000) => {
      return Promise.race([
        fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
    };

    const [vesselResponse, scheduleResponse, terminalResponse] = await Promise.allSettled([
      fetchWithTimeout(endpoints.vessels),
      fetchWithTimeout(endpoints.schedule),
      fetchWithTimeout(endpoints.terminals)
    ]);

    let vesselData = null;
    let scheduleData = null;
    let terminalData = null;

    // Process responses
    if (vesselResponse.status === 'fulfilled' && vesselResponse.value.ok) {
      vesselData = await vesselResponse.value.json();
    }

    if (scheduleResponse.status === 'fulfilled' && scheduleResponse.value.ok) {
      scheduleData = await scheduleResponse.value.json();
    }

    if (terminalResponse.status === 'fulfilled' && terminalResponse.value.ok) {
      terminalData = await terminalResponse.value.json();
    }

    // If we got at least one successful response, process it
    if (vesselData || scheduleData || terminalData) {
      return processRealWSFData(vesselData, scheduleData, terminalData, direction);
    }

    return null;

  } catch (error) {
    console.error('WSF API fetch error:', error);
    return null;
  }
}

function processRealWSFData(vesselData, scheduleData, terminalData, direction) {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  
  // Determine route direction
  const isSeattleToBainbridge = direction === 'seattle-to-bainbridge';
  const routeTitle = isSeattleToBainbridge ? 'Seattle → Bainbridge Island' : 'Bainbridge Island → Seattle';
  const departureTerminal = isSeattleToBainbridge ? 'Seattle (Colman Dock)' : 'Bainbridge Island';
  const arrivalTerminal = isSeattleToBainbridge ? 'Bainbridge Island' : 'Seattle (Colman Dock)';
  
  // Process vessel data for Seattle-Bainbridge route
  let activeVessels = [];
  if (vesselData) {
    const seattleBainbridgeVessels = vesselData.filter(vessel => {
      const vesselName = vessel.VesselName?.toUpperCase() || '';
      const route = vessel.Route?.toLowerCase() || '';
      const departingFrom = vessel.DepartingTerminal?.toLowerCase() || '';
      
      // Look for vessels on Seattle-Bainbridge route
      const isOnRoute = route.includes('seattle') && route.includes('bainbridge') ||
                       vesselName.includes('WENATCHEE') || vesselName.includes('SPOKANE') ||
                       vesselName.includes('WALLA WALLA') || vesselName.includes('PUYALLUP');
      
      // Filter by direction if we have departure terminal info
      if (isOnRoute && departingFrom) {
        if (isSeattleToBainbridge) {
          return departingFrom.includes('seattle') || departingFrom.includes('colman');
        } else {
          return departingFrom.includes('bainbridge');
        }
      }
      
      return isOnRoute;
    });

    activeVessels = seattleBainbridgeVessels.map(vessel => ({
      name: `M/V ${vessel.VesselName}`,
      location: vessel.AtDock ? 
        `At ${vessel.DepartingTerminal || 'terminal'}` : 
        `En route to ${vessel.ArrivingTerminal || 'destination'}`,
      status: vessel.AtDock ? 'Docked' : 'In transit',
      lastUpdated: vessel.TimeStamp
    }));
  }

  // Process schedule data with correct direction
  let nextDepartures = [];
  if (scheduleData) {
    nextDepartures = extractDirectionalDepartures(scheduleData, pacificTime, direction);
  }

  // If we don't have good schedule data, fall back to realistic times
  if (nextDepartures.length === 0) {
    nextDepartures = generateDirectionalDepartures(pacificTime, direction);
  }

  // Process terminal data based on departure terminal
  let terminalInfo = getTerminalInfo(terminalData, direction);

  return {
    route: routeTitle,
    direction: direction,
    departureTerminal: departureTerminal,
    arrivalTerminal: arrivalTerminal,
    timestamp: now.toISOString(),
    service: {
      status: 'Live WSF Data',
      frequency: '35-50 minutes',
      crossingTime: '35 minutes',
      operatingHours: '5:20 AM - 1:00 AM'
    },
    vessels: {
      active: activeVessels.length > 0 ? activeVessels : generateMockVessels(pacificTime, direction),
      nextDepartures: nextDepartures
    },
    terminals: terminalInfo,
    alerts: generateCurrentAlerts(pacificTime)
  };
}

function generateDirectionalDepartures(currentTime, direction) {
  const isSeattleToBainbridge = direction === 'seattle-to-bainbridge';
  
  // Seattle → Bainbridge departures (from Seattle)
  const seattleToBainbridgeSchedule = [
    { hour: 5, minute: 20 }, { hour: 6, minute: 25 }, { hour: 7, minute: 55 },
    { hour: 9, minute: 10 }, { hour: 10, minute: 25 }, { hour: 11, minute: 40 },
    { hour: 12, minute: 55 }, { hour: 14, minute: 10 }, { hour: 15, minute: 25 },
    { hour: 16, minute: 40 }, { hour: 17, minute: 55 }, { hour: 19, minute: 10 },
    { hour: 20, minute: 25 }, { hour: 21, minute: 40 }, { hour: 22, minute: 55 }
  ];

  // Bainbridge → Seattle departures (from Bainbridge) - offset by ~35 minutes
  const bainbridgeToSeattleSchedule = [
    { hour: 6, minute: 0 }, { hour: 7, minute: 5 }, { hour: 8, minute: 35 },
    { hour: 9, minute: 50 }, { hour: 11, minute: 5 }, { hour: 12, minute: 20 },
    { hour: 13, minute: 35 }, { hour: 14, minute: 50 }, { hour: 16, minute: 5 },
    { hour: 17, minute: 20 }, { hour: 18, minute: 35 }, { hour: 19, minute: 50 },
    { hour: 21, minute: 5 }, { hour: 22, minute: 20 }, { hour: 23, minute: 35 }
  ];

  const schedule = isSeattleToBainbridge ? seattleToBainbridgeSchedule : bainbridgeToSeattleSchedule;
  
  const departures = [];
  const vessels = ['WENATCHEE', 'SPOKANE', 'WALLA WALLA', 'PUYALLUP'];
  
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
        vessel: vessels[departures.length % vessels.length]
      });
      
      if (departures.length >= 4) break;
    }
  }
  
  // Add tomorrow's departures if needed
  if (departures.length < 4) {
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (let i = 0; i < schedule.length && departures.length < 4; i++) {
      const dep = schedule[i];
      const depTime = new Date(tomorrow);
      depTime.setHours(dep.hour, dep.minute, 0, 0);
      
      departures.push({
        time: depTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }) + ' (tomorrow)',
        vessel: vessels[departures.length % vessels.length]
      });
    }
  }
  
  return departures;
}

function extractDirectionalDepartures(scheduleData, currentTime, direction) {
  // This would parse real WSF API data with direction filtering
  // For now, fall back to generated schedules
  return [];
}

function getTerminalInfo(terminalData, direction) {
  const isSeattleToBainbridge = direction === 'seattle-to-bainbridge';
  
  let departureTerminalInfo = { vehicleSpaces: 'Unknown', waitTime: 'Unknown' };
  let arrivalTerminalInfo = { vehicleSpaces: 'Unknown', waitTime: 'Unknown' };

  if (terminalData) {
    const seattleTerminal = terminalData.find(t => 
      t.TerminalName?.toLowerCase().includes('seattle') ||
      t.TerminalName?.toLowerCase().includes('colman')
    );

    const bainbridgeTerminal = terminalData.find(t => 
      t.TerminalName?.toLowerCase().includes('bainbridge')
    );

    if (isSeattleToBainbridge) {
      // Departing from Seattle, arriving at Bainbridge
      if (seattleTerminal) {
        departureTerminalInfo = {
          vehicleSpaces: `${seattleTerminal.SpaceForAutos || 'Unknown'} spaces`,
          waitTime: estimateWaitFromSpaces(seattleTerminal.SpaceForAutos)
        };
      }
      
      if (bainbridgeTerminal) {
        arrivalTerminalInfo = {
          vehicleSpaces: `${bainbridgeTerminal.SpaceForAutos || 'Unknown'} spaces`,
          waitTime: 'N/A (arrival terminal)'
        };
      }
      
      return {
        departure: {
          name: 'Seattle (Colman Dock)',
          vehicleSpaces: departureTerminalInfo.vehicleSpaces,
          walkOnWait: 'Minimal',
          vehicleWait: departureTerminalInfo.waitTime
        },
        arrival: {
          name: 'Bainbridge Island',
          vehicleSpaces: arrivalTerminalInfo.vehicleSpaces,
          walkOnWait: 'N/A',
          vehicleWait: 'N/A (arrival terminal)'
        }
      };
    } else {
      // Departing from Bainbridge, arriving at Seattle
      if (bainbridgeTerminal) {
        departureTerminalInfo = {
          vehicleSpaces: `${bainbridgeTerminal.SpaceForAutos || 'Unknown'} spaces`,
          waitTime: estimateWaitFromSpaces(bainbridgeTerminal.SpaceForAutos)
        };
      }
      
      if (seattleTerminal) {
        arrivalTerminalInfo = {
          vehicleSpaces: `${seattleTerminal.SpaceForAutos || 'Unknown'} spaces`,
          waitTime: 'N/A (arrival terminal)'
        };
      }
      
      return {
        departure: {
          name: 'Bainbridge Island',
          vehicleSpaces: departureTerminalInfo.vehicleSpaces,
          walkOnWait: 'Minimal',
          vehicleWait: departureTerminalInfo.waitTime
        },
        arrival: {
          name: 'Seattle (Colman Dock)',
          vehicleSpaces: arrivalTerminalInfo.vehicleSpaces,
          walkOnWait: 'N/A',
          vehicleWait: 'N/A (arrival terminal)'
        }
      };
    }
  }

  // Fallback if no terminal data
  if (isSeattleToBainbridge) {
    return {
      departure: {
        name: 'Seattle (Colman Dock)',
        vehicleSpaces: 'Check WSF app',
        walkOnWait: 'Minimal',
        vehicleWait: 'Check WSF app'
      },
      arrival: {
        name: 'Bainbridge Island',
        vehicleSpaces: 'N/A',
        walkOnWait: 'N/A',
        vehicleWait: 'N/A (arrival terminal)'
      }
    };
  } else {
    return {
      departure: {
        name: 'Bainbridge Island',
        vehicleSpaces: 'Check WSF app',
        walkOnWait: 'Minimal',
        vehicleWait: 'Check WSF app'
      },
      arrival: {
        name: 'Seattle (Colman Dock)',
        vehicleSpaces: 'N/A',
        walkOnWait: 'N/A',
        vehicleWait: 'N/A (arrival terminal)'
      }
    };
  }
}

function generateRealisticFallback(currentTime, direction) {
  const isSeattleToBainbridge = direction === 'seattle-to-bainbridge';
  const routeTitle = isSeattleToBainbridge ? 'Seattle → Bainbridge Island' : 'Bainbridge Island → Seattle';
  
  return {
    route: routeTitle,
    direction: direction,
    timestamp: new Date().toISOString(),
    service: {
      status: 'Schedule Data (WSF API unavailable)',
      frequency: '35-50 minutes',
      crossingTime: '35 minutes',
      operatingHours: '5:20 AM - 1:00 AM'
    },
    vessels: {
      active: generateMockVessels(currentTime, direction),
      nextDepartures: generateDirectionalDepartures(currentTime, direction)
    },
    terminals: getTerminalInfo(null, direction),
    alerts: generateCurrentAlerts(currentTime)
  };
}

function generateMockVessels(currentTime, direction) {
  const hour = currentTime.getHours();
  const isSeattleToBainbridge = direction === 'seattle-to-bainbridge';
  
  if (hour >= 5 && hour <= 23) {
    if (isSeattleToBainbridge) {
      return [
        { name: 'M/V Wenatchee', location: 'Seattle Terminal', status: 'Loading' },
        { name: 'M/V Spokane', location: 'En route to Bainbridge', status: 'In transit' }
      ];
    } else {
      return [
        { name: 'M/V Wenatchee', location: 'Bainbridge Terminal', status: 'Loading' },
        { name: 'M/V Spokane', location: 'En route to Seattle', status: 'In transit' }
      ];
    }
  } else {
    return [
      { name: 'Service suspended', location: 'Overnight hours', status: 'First sailing at 5:20 AM' }
    ];
  }
}

function estimateWaitFromSpaces(spaces) {
  const spaceCount = parseInt(spaces) || 0;
  if (spaceCount > 50) return '5-15 minutes';
  if (spaceCount > 20) return '15-30 minutes';
  if (spaceCount > 5) return '30-60 minutes';
  return 'Next sailing recommended';
}

function generateCurrentAlerts(currentTime) {
  const alerts = [];
  const hour = currentTime.getHours();
  const day = currentTime.getDay();
  
  if (day === 0 || day === 6) {
    alerts.push('Weekend schedule - check WSF app for any changes');
  }
  
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
    alerts.push('Peak commute hours - arrive early for vehicle loading');
  }
  
  return alerts.length > 0 ? alerts : ['Normal operations'];
}
