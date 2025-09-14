// api/ferries.js - Debug version to see what's happening
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
    // Get current Pacific Time
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    console.log('Current time:', pacificTime.toLocaleString());
    
    // For now, let's just return the realistic fallback to get it working
    const ferryInfo = generateRealisticFerryData(pacificTime);
    
    res.status(200).json(ferryInfo);
    
  } catch (error) {
    console.error('Ferry API error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch ferry data',
      message: error.message 
    });
  }
}

function generateRealisticFerryData(currentTime) {
  // Seattle → Bainbridge departures (from Seattle)
  const seattleToBainbridgeSchedule = [
    { hour: 5, minute: 20 }, { hour: 6, minute: 25 }, { hour: 7, minute: 55 },
    { hour: 9, minute: 10 }, { hour: 10, minute: 25 }, { hour: 11, minute: 40 },
    { hour: 12, minute: 55 }, { hour: 14, minute: 10 }, { hour: 15, minute: 25 },
    { hour: 16, minute: 40 }, { hour: 17, minute: 55 }, { hour: 19, minute: 10 },
    { hour: 20, minute: 25 }, { hour: 21, minute: 40 }, { hour: 22, minute: 55 }
  ];

  const departures = [];
  const vessels = ['WENATCHEE', 'SPOKANE', 'WALLA WALLA', 'PUYALLUP'];
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  console.log(`Looking for departures after ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
  
  // Find next departures
  for (let i = 0; i < seattleToBainbridgeSchedule.length; i++) {
    const dep = seattleToBainbridgeSchedule[i];
    const depTime = new Date(currentTime);
    depTime.setHours(dep.hour, dep.minute, 0, 0);
    
    console.log(`Checking departure: ${dep.hour}:${dep.minute.toString().padStart(2, '0')}`);
    
    if (depTime > currentTime) {
      const timeString = depTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      departures.push({
        time: timeString,
        vessel: vessels[departures.length % vessels.length]
      });
      
      console.log(`Added departure: ${timeString}`);
      
      if (departures.length >= 4) break;
    }
  }
  
  // Add tomorrow's departures if needed
  if (departures.length < 4) {
    console.log('Adding tomorrow departures...');
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (let i = 0; i < seattleToBainbridgeSchedule.length && departures.length < 4; i++) {
      const dep = seattleToBainbridgeSchedule[i];
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
  
  console.log('Final departures:', departures);

  return {
    route: 'Seattle → Bainbridge Island',
    timestamp: new Date().toISOString(),
    currentPacificTime: currentTime.toLocaleString(),
    service: {
      status: 'Normal Operations',
      frequency: '35-50 minutes',
      crossingTime: '35 minutes',
      operatingHours: '5:20 AM - 1:00 AM'
    },
    vessels: {
      active: [
        { name: 'M/V Wenatchee', location: 'Seattle Terminal', status: 'Loading passengers' },
        { name: 'M/V Spokane', location: 'En route to Bainbridge', status: 'In transit' }
      ],
      nextDepartures: departures
    },
    terminals: {
      departure: {
        name: 'Seattle (Colman Dock)',
        vehicleSpaces: '30-50 spaces available',
        walkOnWait: 'Minimal',
        vehicleWait: '15-30 minutes'
      },
      arrival: {
        name: 'Bainbridge Island',
        vehicleSpaces: 'N/A (arrival terminal)',
        walkOnWait: 'N/A',
        vehicleWait: 'N/A'
      }
    },
    alerts: ['Normal operations'],
    debug: {
      currentHour: currentTime.getHours(),
      currentMinute: currentTime.getMinutes(),
      totalDeparturesFound: departures.length
    }
  };
}
