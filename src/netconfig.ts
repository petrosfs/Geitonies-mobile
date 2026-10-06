/*
 * Connection settings for online games.
 *
 * Phones first try to connect directly (STUN). When both are behind strict routers or mobile networks
 * (common between countries), the data must go through a relay (TURN). A free public relay is listed below;
 * for a reliable one of your own, create a free account at https://www.metered.ca/tools/openrelay/
 * and paste the "TURN credentials" URL of your app here (it looks like
 * https://YOUR-APP.metered.live/api/v1/turn/credentials?apiKey=...).
 */
export const TURN_CREDENTIALS_URL = '';

/**
 * Public servers used when no relay of our own is configured.
 * - STUN (Google, Cloudflare): lets phones find a direct path to each other.
 * - TURN (Open Relay): a free public relay for when no direct path exists (strict routers, mobile networks,
 *   different countries). Best effort: it has no guarantee; configure your own above for reliability.
 * Note: the relays PeerJS used to ship (eu-0/us-0.turn.peerjs.com) no longer exist, so they are not listed.
 */
const DEFAULT_ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

let extra: RTCIceServer[] = [];
let loading: Promise<void> | null = null;

/** fetch the relay credentials once (if configured); never throws */
export function loadIceServers(): Promise<void> {
  if (!TURN_CREDENTIALS_URL) return Promise.resolve();
  loading ??= fetch(TURN_CREDENTIALS_URL)
    .then((r) => (r.ok ? r.json() : []))
    .then((list: unknown) => { if (Array.isArray(list)) extra = list as RTCIceServer[]; })
    .catch(() => { loading = null; });
  return loading;
}

/** options for every new Peer: our relay (if any) first, then the defaults */
export function peerOptions() {
  return { config: { iceServers: [...extra, ...DEFAULT_ICE] } };
}

export const hasOwnRelay = () => extra.length > 0;
