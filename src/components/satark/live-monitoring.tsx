import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/satark/portal";
import { Button } from "@/components/ui/button";
import { Radio, RefreshCw, ShieldCheck, Signal, WifiOff } from "lucide-react";

type LiveStream = {
  name: string;
  organization: string;
  whepUrl: string;
};

type StreamConfig = {
  streams: LiveStream[];
  error: string;
};

function readStreamConfig(): StreamConfig {
  const rawConfig = import.meta.env.VITE_LIVE_STREAMS;
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
          <span className={`size-2 rounded-full ${status === "Live" ? "bg-success" : status === "Connecting" ? "bg-warning" : "bg-destructive"}`} />
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
  const config = readStreamConfig();
  return (
    <>
      <PageHeader eyebrow="Authorized monitoring" title="Live Monitoring" description="MediaMTX streams delivered to this browser over WebRTC." />
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-warning" />
        <span><b>Restricted access.</b> Configure stream authentication and network access at the MediaMTX gateway.</span>
      </div>
      {config.error ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm" role="alert">
          <WifiOff className="size-5 shrink-0 text-destructive" />{config.error}
        </div>
      ) : config.streams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Radio className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-bold">No live streams configured</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Set VITE_LIVE_STREAMS to a JSON array of stream names, organizations, and MediaMTX WHEP URLs, then restart the dashboard.</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"><Signal className="size-4" />Expected endpoint format: https://host:8889/path/whep</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {config.streams.map((stream) => <WebRtcStream key={stream.whepUrl} stream={stream} />)}
        </div>
      )}
    </>
  );
}