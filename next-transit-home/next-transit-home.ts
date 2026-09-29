#!/usr/bin/env node
// Lists the next southbound BART trains from Montgomery that connect to a Muni bus home,
// leaving at least MIN_TRANSFER_MINUTES between the train arriving and the bus arriving.
// Times come from the 511 SF Bay StopMonitoring API. Each run makes one request per stop,
// and a 511 key allows 60 requests per hour.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { styleText } from 'node:util';

const MIN_TRANSFER_MINUTES = 3;
const TRAINS_PER_ROUTE = 3;

// 511 stop codes. Platform 1 is the southbound platform at each BART station.
const MONTGOMERY_SOUTHBOUND = '901201';
const ROUTES = [
  { bartStation: '24th St Mission', bartStopCode: '901601', line: '48', muniStopCode: '13477' }, // 24th St & Mission St
  { bartStation: 'Civic Center', bartStopCode: '901401', line: '19', muniStopCode: '13209' }, // 8th St & Market St
];

type StopVisit = { trip: string; line: string; time: number };

const ENV_FILE = join(import.meta.dirname, '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const { API_KEY_511 } = process.env;
if (!API_KEY_511) {
  console.error(`Set API_KEY_511 in ${ENV_FILE}. Get a key at https://511.org/open-data/token`);
  process.exit(1);
}

const now = Date.now();
const montgomeryTrains = fetchStopVisits('BA', MONTGOMERY_SOUTHBOUND);
const plans = await Promise.all(
  ROUTES.map(async (route) => {
    const [trains, transferArrivals, stopVisits] = await Promise.all([
      montgomeryTrains,
      fetchStopVisits('BA', route.bartStopCode),
      fetchStopVisits('SF', route.muniStopCode),
    ]);
    // Other lines share these stops, such as the 27 at 8th St & Market St.
    const buses = stopVisits.filter(({ line }) => line === route.line);
    return { route, connections: findConnections(trains, transferArrivals, buses) };
  }),
);

for (const { route, connections } of plans) {
  console.log(styleText(['bold', 'cyan'], `\nMontgomery → ${route.bartStation} → ${route.line}`));
  if (connections.length === 0) console.log(styleText('yellow', '  No connection in the current predictions'));
  for (const { train, arrival, bus } of connections) {
    // Columns are padded before coloring so rows line up across both routes.
    const columns = [
      `${styleText('blue', 'BART')} ${styleText('bold', clock(train))}`,
      styleText('dim', `(${minutesBetween(now, train)} min)`.padEnd(8)),
      `${styleText('dim', 'arrives')} ${styleText('bold', clock(arrival))}`,
      `${styleText('magenta', `${route.line} at`)} ${styleText('bold', clock(bus))}`,
      styleText('green', `(${minutesBetween(arrival, bus)} min to transfer)`),
    ];
    console.log(`  ${columns.join('  ')}`);
  }
}

// Pairs each upcoming train with the first bus that leaves enough time to transfer.
function findConnections(trains: StopVisit[], transferArrivals: StopVisit[], buses: StopVisit[]) {
  const arrivalByTrip = new Map(transferArrivals.map(({ trip, time }) => [trip, time]));
  return trains
    .filter(({ time }) => time > now)
    .flatMap((train) => {
      const arrival = arrivalByTrip.get(train.trip);
      if (arrival === undefined) return [];
      const bus = buses.find(({ time }) => minutesBetween(arrival, time) >= MIN_TRANSFER_MINUTES);
      return bus ? [{ train: train.time, arrival, bus: bus.time }] : [];
    })
    .slice(0, TRAINS_PER_ROUTE);
}

async function fetchStopVisits(agency: 'BA' | 'SF', stopCode: string): Promise<StopVisit[]> {
  const query = new URLSearchParams({ api_key: API_KEY_511!, agency, stopCode, format: 'json' });
  const response = await fetch(`https://api.511.org/transit/StopMonitoring?${query}`);
  if (!response.ok) {
    console.error(`511 answered ${response.status} for ${agency} stop ${stopCode}: ${await response.text()}`);
    process.exit(1);
  }
  const body = await response.json();
  // The 511 spec shows a single visit as an object rather than a one-item array.
  const visits = [body.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit ?? []].flat();
  return visits
    .map(({ MonitoredVehicleJourney: journey }) => ({
      trip: journey.FramedVehicleJourneyRef.DatedVehicleJourneyRef,
      line: journey.LineRef,
      // The schedule stands in when a vehicle has no real-time prediction.
      time: Date.parse(journey.MonitoredCall.ExpectedArrivalTime ?? journey.MonitoredCall.AimedArrivalTime),
    }))
    .filter(({ time }) => !Number.isNaN(time))
    .sort((a, b) => a.time - b.time);
}

function minutesBetween(from: number, to: number) {
  return Math.floor((to - from) / 60_000);
}

function clock(time: number) {
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).padStart(8);
}
