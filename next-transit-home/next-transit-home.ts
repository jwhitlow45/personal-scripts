#!/usr/bin/env node
// Lists the next southbound BART trains from Montgomery that connect to a Muni bus home,
// leaving at least MIN_TRANSFER_MINUTES between the train arriving and the bus arriving.
// Times come from GTFS-realtime trip updates: BART's own feed, which needs no key, and 511's
// Muni feed. These reach further ahead than 511's per-stop API, which returns only the next
// 3 buses per line. Each run makes one 511 request, and a 511 key allows 60 per hour.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { styleText } from 'node:util';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const MIN_TRANSFER_MINUTES = 3;
const TRAINS_PER_ROUTE = 3;

// Stop ids as each feed names them. Platform 1 is the southbound platform at each BART station,
// and 511 names Muni stops by their stop code.
const MONTGOMERY_SOUTHBOUND = 'M20-1';
const ROUTES = [
  { bartStation: '24th St Mission', bartStopId: 'M60-1', line: '48', muniStopId: '13477' }, // 24th St & Mission St
  { bartStation: 'Civic Center', bartStopId: 'M40-1', line: '19', muniStopId: '13209' }, // 8th St & Market St
];

type Trip = { routeId?: string | null; stopTimes: Map<string, number> };

const ENV_FILE = join(import.meta.dirname, '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const { API_KEY_511 } = process.env;
if (!API_KEY_511) {
  console.error(`Set API_KEY_511 in ${ENV_FILE}. Get a key at https://511.org/open-data/token`);
  process.exit(1);
}

const now = Date.now();
const [bartTrips, muniTrips] = await Promise.all([
  fetchTrips('https://api.bart.gov/gtfsrt/tripupdate.aspx'),
  fetchTrips(`https://api.511.org/transit/tripupdates?${new URLSearchParams({ api_key: API_KEY_511, agency: 'SF' })}`),
]);

for (const route of ROUTES) {
  const connections = findConnections(route, bartTrips, muniTrips);
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
function findConnections(route: (typeof ROUTES)[number], bartTrips: Trip[], muniTrips: Trip[]) {
  // Other lines share these stops, such as the 27 at 8th St & Market St.
  const buses = muniTrips
    .filter(({ routeId }) => routeId === route.line)
    .flatMap(({ stopTimes }) => stopTimes.get(route.muniStopId) ?? [])
    .sort((a, b) => a - b);
  return bartTrips
    .flatMap(({ stopTimes }) => {
      const train = stopTimes.get(MONTGOMERY_SOUTHBOUND);
      const arrival = stopTimes.get(route.bartStopId);
      if (train === undefined || arrival === undefined || train <= now) return [];
      const bus = buses.find((time) => minutesBetween(arrival, time) >= MIN_TRANSFER_MINUTES);
      return bus === undefined ? [] : [{ train, arrival, bus }];
    })
    .sort((a, b) => a.train - b.train)
    .slice(0, TRAINS_PER_ROUTE);
}

// Maps each trip in a GTFS-realtime feed to its predicted time at each stop,
// leaving out canceled trips and stops the vehicle will skip.
async function fetchTrips(url: string): Promise<Trip[]> {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`${new URL(url).host} answered ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  const { FeedMessage, TripDescriptor, TripUpdate } = GtfsRealtimeBindings.transit_realtime;
  const feed = FeedMessage.decode(new Uint8Array(await response.arrayBuffer()));
  return feed.entity.flatMap(({ tripUpdate }) => {
    if (!tripUpdate || tripUpdate.trip.scheduleRelationship === TripDescriptor.ScheduleRelationship.CANCELED) return [];
    const stopTimes = (tripUpdate.stopTimeUpdate ?? []).flatMap(({ stopId, arrival, departure, scheduleRelationship }) => {
      // Times are unix seconds held as 64-bit values, and an absent time decodes as zero.
      const time = Number(arrival?.time) || Number(departure?.time);
      const isStopping = scheduleRelationship !== TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED;
      return stopId && time && isStopping ? [[stopId, time * 1000] as const] : [];
    });
    return [{ routeId: tripUpdate.trip.routeId, stopTimes: new Map(stopTimes) }];
  });
}

function minutesBetween(from: number, to: number) {
  return Math.floor((to - from) / 60_000);
}

function clock(time: number) {
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).padStart(8);
}
