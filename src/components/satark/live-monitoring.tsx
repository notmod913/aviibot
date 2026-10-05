import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/satark/portal";
import { Button } from "@/components/ui/button";
import { Plus, Radio, RefreshCw, ShieldCheck, Signal, Trash2, WifiOff } from "lucide-react";

type LiveStream = {
  name: string;
  organization: string;
  whepUrl: string;
};

type StreamConfig = {
  streams: LiveStream[];
  error: string;
};

const STREAM_CONFIG_KEY = "satark-live-streams";

function parseStreamConfig(rawConfig: string | null | undefined): StreamConfig {
  if (!rawConfig) return { streams: [], error: "" };

  try {
    const parsed: unknown = JSON.parse(rawConfig);
    if (!Array.isArray(parsed)) throw new Error("Stream configuration must be a JSON array.");
    const streams = parsed.filter((stream): stream is LiveStream =>
      typeof stream?.name === "string" &&
      typeof stream?.organization === "string" &&
      typeof stream?.whepUrl === "string" &&
      /^https?:\/\//.test(stream.whepUrl),
    );
    if (streams.length !== parsed.length) throw new Error("Every stream needs a name, organization, and HTTP(S) WHEP URL.");
    return { streams, error: "" };
  } catch (error) {
    return { streams: [], error: error instanceof Error ? error.message : "Invalid stream configuration." };
  }
}

function readStreamConfig(): StreamConfig {
  return parseStreamConfig(import.meta.env.VITE_LIVE_STREAMS);
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("ICE gathering timed out. Check the MediaMTX WebRTC and firewall configuration."));
    }, 10000);
    const onChange = () => {
      if (peer.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onChange);
    };
    peer.addEventListener("icegatheringstatechange", onChange);
  });
}

function WebRtcStream({ stream }: { stream: LiveStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Connecting");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let peer: RTCPeerConnection | undefined;
    let sessionUrl: string | undefined;
    const abortController = new AbortController();

    async function connect() {
      setStatus("Connecting");
      setError("");
      try {
        peer = new RTCPeerConnection();
        peer.addTransceiver("video", { direction: "recvonly" });
        peer.addTransceiver("audio", { direction: "recvonly" });
        peer.ontrack = (event) => {
          if (!active || !videoRef.current) return;
          videoRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          videoRef.current.play().catch(() => setError("Playback was blocked. Use the video controls to start playback."));
        };
        peer.onconnectionstatechange = () => {
          if (!active || !peer) return;
          if (peer.connectionState === "connected") setStatus("Live");
          if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
            setStatus("Disconnected");
            setError("Stream connection was lost. Retry or check the WebRTC network configuration.");
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForIceGathering(peer);
        const response = await fetch(stream.whepUrl, {
          method: "POST",
          headers: { Accept: "application/sdp", "Content-Type": "application/sdp" },
          body: peer.localDescription?.sdp,
          signal: abortController.signal,
        });
        if (response.status === 404) {
          setStatus("Waiting for camera");
          setError("No camera is publishing to this path. Start Larix, then select Reconnect.");
          return;
        }
        if (!response.ok) throw new Error(`WHEP request failed (${response.status}). Check the stream path and MediaMTX access settings.`);
        const answer = await response.text();
        const locationHeader = response.headers.get("Location");
        sessionUrl = locationHeader ? new URL(locationHeader, response.url).toString() : undefined;
        await peer.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (connectError) {
        if (!active) return;
        setStatus("Unavailable");
        setError(connectError instanceof Error ? connectError.message : "Could not connect to the WebRTC stream.");
      }
    }

    void connect();
    return () => {
      active = false;
      abortController.abort();
      peer?.close();
      if (sessionUrl) void fetch(sessionUrl, { method: "DELETE", keepalive: true }).catch(() => {});
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream.whepUrl, attempt]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{stream.name}</p>
          <p className="truncate text-xs text-muted-foreground">{stream.organization}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold">
          <span className={`size-2 rounded-full ${status === "Live" ? "bg-success" : status === "Connecting" || status === "Waiting for camera" ? "bg-warning" : "bg-destructive"}`} />
          {status}
        </span>
      </div>
      <div className="aspect-video bg-black">
        <video ref={videoRef} className="size-full object-contain" controls autoPlay playsInline muted aria-label={`${stream.name} live feed`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground" role="status">{error}</p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)} disabled={status === "Connecting"}>
          <RefreshCw />Reconnect
        </Button>
      </div>
    </div>
  );
}

export function LiveMonitoringPage() {
  const [defaults] = useState(readStreamConfig);
  const [streams, setStreams] = useState(defaults.streams);
  const [configError, setConfigError] = useState(defaults.error);
  const [streamName, setStreamName] = useState("");
  const [organization, setOrganization] = useState("");
  const [whepUrl, setWhepUrl] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STREAM_CONFIG_KEY);
      if (!saved) {
        if (defaults.streams.length === 0) {
          const host = window.location.hostname || "localhost";
          setStreams([{
            name: "Entrance",
            organization: "Live camera",
            whepUrl: `http://${host}:8889/live/entrance/whep`,
          }]);
        }
        return;
      }
      const config = parseStreamConfig(saved);
      if (config.error) {
        setConfigError(config.error);
        return;
      }
      const migratedStreams = config.streams.map((stream) => {
        const endpoint = new URL(stream.whepUrl);
        if (
          stream.name === "Entrance" &&
          stream.organization === "Live camera" &&
          endpoint.pathname.replace(/\/+$/, "") === "/entrance/whep"
        ) {
          endpoint.pathname = "/live/entrance/whep";
          return { ...stream, whepUrl: endpoint.toString() };
        }
        return stream;
      });
      setStreams(migratedStreams);
      if (migratedStreams.some((stream, index) => stream.whepUrl !== config.streams[index]?.whepUrl)) {
        window.localStorage.setItem(STREAM_CONFIG_KEY, JSON.stringify(migratedStreams));
      }
      setConfigError("");
    } catch {
      setConfigError("Saved camera settings could not be read.");
    }
  }, []);

  function saveStreams(nextStreams: LiveStream[]) {
    setStreams(nextStreams);
    setConfigError("");
    try {
      window.localStorage.setItem(STREAM_CONFIG_KEY, JSON.stringify(nextStreams));
    } catch {
      setConfigError("Camera settings could not be saved in this browser.");
    }
  }

  function addStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = whepUrl.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(endpoint);
    } catch {
      setConfigError("Enter a valid MediaMTX WHEP URL.");
      return;
    }
    if (!/^https?:$/.test(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || !parsedUrl.pathname.replace(/\/+$/, "").endsWith("/whep")) {
      setConfigError("Use an HTTP(S) MediaMTX endpoint ending in /whep. Do not include credentials in the URL.");
      return;
    }
    if (streams.some((stream) => stream.whepUrl === endpoint)) {
      setConfigError("That WHEP endpoint is already configured.");
      return;
    }
    saveStreams([...streams, { name: streamName.trim(), organization: organization.trim(), whepUrl: endpoint }]);
    setStreamName("");
    setOrganization("");
    setWhepUrl("");
  }

  return (
    <>
      <PageHeader eyebrow="Authorized monitoring" title="Live Monitoring" description="MediaMTX streams delivered to this browser over WebRTC." />
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-warning" />
        <span><b>Local-network demo only.</b> Only publish authorized cameras on a trusted private Wi-Fi network. Configure authentication and firewall restrictions before using this outside your development network.</span>
      </div>
      <section className="mb-5 space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-sm font-bold">CCTV stream settings</h2>
          <p className="mt-1 text-xs text-muted-foreground">In Larix, set the RTMP application to <code>live</code> and stream name to <code>entrance</code> (full URL: <code>rtmp://&lt;PC-LAN-IP&gt;:1935/live/entrance</code>). Find the PC IPv4 address with <code>ipconfig</code>; the phone and PC must be on the same Wi-Fi.</p>
        </div>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={addStream}>
          <label className="text-xs font-medium">Camera name<input required maxLength={100} value={streamName} onChange={(event) => setStreamName(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="Entrance" /></label>
          <label className="text-xs font-medium">Organization<input required maxLength={150} value={organization} onChange={(event) => setOrganization(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="Organization name" /></label>
          <label className="text-xs font-medium md:col-span-2">WHEP URL<input required type="url" value={whepUrl} onChange={(event) => setWhepUrl(event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="http://localhost:8889/live/entrance/whep" /></label>
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
            <Button type="submit" size="sm"><Plus />Add camera</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { window.localStorage.removeItem(STREAM_CONFIG_KEY); setStreams(defaults.streams); setConfigError(defaults.error); }}>Restore environment defaults</Button>
          </div>
        </form>
        {configError && <p className="text-sm text-destructive" role="alert">{configError}</p>}
        {streams.length > 0 && <ul className="divide-y rounded-md border">{streams.map((stream) => <li key={stream.whepUrl} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="text-sm font-semibold">{stream.name} <span className="font-normal text-muted-foreground">· {stream.organization}</span></p><p className="truncate text-xs text-muted-foreground">{stream.whepUrl}</p></div><Button type="button" variant="outline" size="sm" onClick={() => saveStreams(streams.filter((item) => item.whepUrl !== stream.whepUrl))}><Trash2 />Remove</Button></li>)}</ul>}
      </section>
      {streams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Radio className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-bold">No live streams configured</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Add an authorized WHEP endpoint above or set VITE_LIVE_STREAMS in the frontend environment.</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"><Signal className="size-4" />Expected endpoint format: https://host:8889/path/whep</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {streams.map((stream) => <WebRtcStream key={stream.whepUrl} stream={stream} />)}
        </div>
      )}
    </>
  );
}