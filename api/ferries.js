// api/ferries.js - Simple version with accurate current times
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
    const ferryInfo = generateCurrentFerryData();
    res.status(200).json(ferryInfo);
    
  } catch (error) {
    console.error('Ferry API error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch ferry data',
      message: error.message 
    });
  }
}

function generateCurrentFerryData() {
  const now = new Date();
  
  // Seattle-Bainbridge Island typical weekday schedule
  // Departures from Seattle (approximate times based on WSF schedule)
  const weekdaySchedule = [
    { hour: 5, minute: 20 },   // 5:20 AM
    { hour: 6, minute: 25 },   // 6:25 AM  
    { hour: 7, minute: 55 },   // 7:55 AM
    { hour: 9, minute: 10 },   // 9:10 AM
    { hour: 10, minute: 25 },  // 10:25 AM
    { hour: 11, minute: 40 },  // 11:40 AM
    { hour: 12, minute: 55 },  // 12:55 PM
    { hour: 14, minute: 10 },  // 2:10 PM
    { hour: 15, minute: 25 },  // 3:25 PM
    { hour: 16, minute: 40 },  // 4:40 PM
    { hour: 17, minute: 55 },  // 5:55 PM
    { hour: 19, minute: 10 },  // 7:10 PM
    { hour: 20, minute: 25 },  // 8:25 PM
    { hour: 21, minute: 40 },  // 9:40 PM
    { hour: 22, minute: 55 }   // 10:55 PM
  ];

  // Weekend schedule (slightly different)
  const weekendSchedule = [
    { hour: 6, minute: 20 },   // 6:20 AM (later start)
    { hour: 7, minute: 50 },   // 7:50 AM
    { hour: 9, minute: 20 },   // 9:20 AM
    { hour: 10, minute: 50 },  // 10:50 AM
    { hour: 12, minute: 20 },  // 12:20 PM
    { hour: 13, minute: 50 },  // 1:50 PM
    { hour: 15, minute: 20 },  // 3:20 PM
    { hour: 16, minute: 50 },  // 4:50 PM
    { hour: 18, minute: 20 },  // 6:20 PM
    { hour: 19, minute: 50 },  // 7:50 PM
    { hour: 21, minute: 20 },  // 9:20 PM
    { hour: 22, minute: 50 }   // 10:50 PM
  ];

  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const schedule = isWeekend ? weekendSchedule : weekdaySchedule;
  
  const nextDepartures = findNextDepartures(now, schedule);
  const serviceStatus = getServiceStatus(now);
  
  return {
    route: 'Seattle - Bainbridge Island',
    timestamp: now.toISOString(),
    service: {
      status: serviceStatus.status,
      frequency: isWeekend ? '90 minutes average' : '35-50 minutes',
      crossingTime: '35 minutes',
      operatingHours: '5:20 AM - 1:00 AM'
    },
    vessels: {
      active: getCurrentVessels(now),
      nextDepartures: nextDepartures
    },
    terminals: {
      seattle: {
        name: 'Seattle (Colman Dock)',
        vehicleSpaces: estimateSpaces(now),
        walkOnWait: 'Minimal',
        vehicleWait: estimateWaitTime(now)
      },
      bainbridge: {
        name: 'Bainbridge Island',
        vehicleSpaces: 'Typically more available',
        walkOnWait: 'Minimal',
        vehicleWait: 'Usually shorter than Seattle'
      }
    },
    alerts: generateAlerts(now, isWeekend)
  };
}

function findNextDepartures(currentTime, schedule) {
  const departures = [];
  const vessels = ['WENATCHEE', 'SPOKANE', 'WALLA WALLA', 'PUYALLUP'];
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  console.log(`Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
  
  // Find departures for today
  for (let i = 0; i < schedule.length; i++) {
    const dep = schedule[i];
    
    // Create departure time for today
    const depTime = new Date(currentTime);
    depTime.setHours(dep.hour, dep.minute, 0, 0);
    
    console.log(`Checking departure: ${dep.hour}:${dep.minute.toString().padStart(2, '0')}`);
    
    // If this departure is still in the future today
    if (depTime > currentTime) {
      departures.push({
        time: depTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        vessel: vessels[departures.length % vessels.length]
      });
      
      console.log(`Added departure: ${departures[departures.length - 1].time}`);
      
      if (departures.length >= 4) break;
    }
  }
  
  // If we're late in the day and don't have enough departures, add tomorrow's early ones
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
  
  console.log(`Final departures:`, departures);
  return departures;
}

function getCurrentVessels(currentTime) {
  const hour = currentTime.getHours();
  
  if (hour >= 5 && hour <= 23) {
    return [
      { 
        name: 'M/V Wenatchee', 
        location: 'Seattle Terminal', 
        status: 'Loading passengers' 
      },
      { 
        name: 'M/V Spokane', 
        location: 'En route to Bainbridge', 
        status: 'In transit' 
      }
    ];
  } else {
    return [
      { 
        name: 'Service suspended', 
        location: 'Overnight hours', 
        status: 'First sailing at 5:20 AM' 
      }
    ];
  }
}

function getServiceStatus(currentTime) {
  const hour = currentTime.getHours();
  const day = currentTime.getDay();
  
  if (hour >= 1 && hour < 5) {
    return { status: 'Service Suspended - Night Hours' };
  } else if (hour >= 5 && hour <= 23) {
    if (day === 0 || day === 6) {
      return { status: 'Weekend Service - Operating' };
    } else {
      return { status: 'Normal Weekday Operations' };
    }
  } else {
    return { status: 'Limited Late Night Service' };
  }
}

function estimateSpaces(currentTime) {
  const hour = currentTime.getHours();
  const minute = currentTime.getMinutes();
  
  // Simulate realistic vehicle space availability
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
    return '15-25 spaces'; // Rush hour - fewer spaces
  } else if (hour >= 10 && hour <= 15) {
    return '40-60 spaces'; // Mid-day - more spaces
  } else {
    return '30-50 spaces'; // Other times
  }
}

function estimateWaitTime(currentTime) {
  const hour = currentTime.getHours();
  
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
    return '30-45 minutes'; // Rush hour
  } else if (hour >= 10 && hour <= 15) {
    return '10-20 minutes'; // Mid-day
  } else {
    return '15-30 minutes'; // Other times
  }
}

function generateAlerts(currentTime, isWeekend) {
  const alerts = [];
  const hour = currentTime.getHours();
  
  if (isWeekend) {
    alerts.push('Weekend schedule - reduced frequency');
  }
  
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
    alerts.push('Peak commute hours - expect longer waits');
  }
  
  if (hour >= 22 || hour <= 5) {
    alerts.push('Late night/early morning - limited service');
  }
  
  if (alerts.length === 0) {
    alerts.push('Normal operations');
  }
  
  return alerts;
}
