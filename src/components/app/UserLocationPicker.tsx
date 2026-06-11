/**
 * UserLocationPicker
 * Simple one-tap location collector for user profiles.
 * Shows a mini Leaflet map with the user's current saved pin.
 * Saves lat/lng + city to /api/user/location.
 */
import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Props {
  token: string | null;
  savedLat?: number | null;
  savedCity?: string | null;
  onSaved?: (lat: number, lng: number, city: string) => void;
}

const EGYPT_CENTER = { lat: 26.82, lng: 30.80 };
const EGYPT_CITIES: [string, number, number][] = [
  ["Cairo",30.0444,31.2357],["Giza",30.0131,31.2089],
  ["Alexandria",31.2001,29.9187],["Hurghada",27.2579,33.8116],
  ["Sharm El Sheikh",27.9158,34.3300],["Luxor",25.6872,32.6396],
  ["Aswan",24.0889,32.8998],["Mansoura",31.0364,31.3807],
  ["Tanta",30.7865,31.0004],["Suez",29.9668,32.5498],
];
function nearestCity(lat:number,lng:number){
  let best="Egypt",bestD=Infinity;
  for(const[n,clat,clng] of EGYPT_CITIES){const d=Math.hypot(lat-clat,lng-clng);if(d<bestD){bestD=d;best=n;}}
  return best;
}

let _loaded = false, _loading: Promise<void>|null = null;
function loadLeaflet(): Promise<void> {
  if (_loaded) return Promise.resolve();
  if (_loading) return _loading;
  _loading = new Promise<void>((ok,fail) => {
    if ((window as any).L) { _loaded=true; ok(); return; }
    const css = document.createElement("link"); css.rel="stylesheet";
    css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload=()=>{_loaded=true;ok();}; s.onerror=fail;
    document.head.appendChild(s);
  });
  return _loading;
}

export default function UserLocationPicker({ token, savedLat, savedCity, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(_loaded);
  const [status, setStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [pinLat, setPinLat] = useState<number|null>(savedLat ?? null);
  const [pinLng, setPinLng] = useState<number|null>(null);
  const [pinCity, setPinCity] = useState(savedCity ?? "");
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPickRef = useRef<((lat:number,lng:number)=>void)|null>(null);

  const placePin = (lat:number,lng:number) => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    const icon = L.divIcon({
      className:"",
      html:`<div style="width:26px;height:26px;background:#FFD600;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(255,214,0,0.5)"></div>`,
      iconSize:[26,26],iconAnchor:[13,26],
    });
    if (markerRef.current) markerRef.current.setLatLng([lat,lng]);
    else { markerRef.current = L.marker([lat,lng],{icon,draggable:true}).addTo(mapRef.current);
      markerRef.current.on("dragend",()=>{
        const p=markerRef.current.getLatLng();
        setPinLat(p.lat); setPinLng(p.lng); setPinCity(nearestCity(p.lat,p.lng));
      });
    }
  };

  const initMap = async () => {
    if (!mapDiv.current) return;
    await loadLeaflet(); setReady(true);
    const L = (window as any).L;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current=null; markerRef.current=null; }
    const lat = pinLat ?? EGYPT_CENTER.lat, lng = pinLng ?? EGYPT_CENTER.lng;
    const map = L.map(mapDiv.current).setView([lat,lng], pinLat ? 12 : 6);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap",maxZoom:18}).addTo(map);
    if (pinLat && pinLng) placePin(pinLat, pinLng);
    map.on("click",(e:any)=>{
      const {lat:clat,lng:clng}=e.latlng;
      placePin(clat,clng);
      setPinLat(clat); setPinLng(clng); setPinCity(nearestCity(clat,clng));
    });
    setTimeout(()=>map.invalidateSize(),100);
  };

  useEffect(()=>{
    if(!open){if(mapRef.current){mapRef.current.remove();mapRef.current=null;markerRef.current=null;}return;}
    const t=setTimeout(initMap,50); return()=>clearTimeout(t);
  },[open]);

  const useGPS = () => {
    if(!navigator.geolocation) return;
    setStatus("saving");
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      const{latitude,longitude}=pos.coords;
      placePin(latitude,longitude);
      setPinLat(latitude); setPinLng(longitude);
      const city=nearestCity(latitude,longitude); setPinCity(city);
      mapRef.current?.setView([latitude,longitude],13,{animate:true});
      setStatus("idle");
    },()=>setStatus("error"),{timeout:10000});
  };

  const save = async () => {
    if(pinLat==null||pinLng==null){setStatus("error");return;}
    setStatus("saving");
    try {
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pinLat}&lon=${pinLng}`,
        {headers:{"Accept-Language":"en"}}
      ).then(r=>r.json()).catch(()=>({}));
      const city = geo?.address?.city||geo?.address?.town||pinCity;
      const country = geo?.address?.country||"Egypt";
      await apiFetch(`/api/user/location`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({latitude:pinLat,longitude:pinLng,city,country}),
      });
      setPinCity(city);
      setStatus("saved");
      onSaved?.(pinLat,pinLng,city);
      setTimeout(()=>{setStatus("idle");setOpen(false);},1500);
    } catch { setStatus("error"); }
  };

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/15">
            <MapPin size={17} strokeWidth={2} className="text-primary" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground">My Location</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {status==="saved" ? "Saved!" :
               pinCity ? `${pinCity}` :
               "Used to show nearby coaches & relevant ads"}
            </p>
          </div>
        </div>
        <Button
          variant={open ? "secondary" : "outline"}
          size="sm"
          onClick={()=>setOpen(o=>!o)}
        >
          {open ? "Close" : pinCity ? "Update" : "Set location"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-lg bg-card shadow-soft">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-3 ps-4">
            <span className="text-[12px] text-muted-foreground">
              {pinLat!=null ? <><span className="font-semibold text-primary">Pinned:</span> {pinCity||"Custom location"} ({pinLat.toFixed(3)}, {(pinLng??0).toFixed(3)})</> : "Click the map or use GPS to set your location"}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={useGPS}
              disabled={status==="saving"}
              className="text-primary"
            >
              <Crosshair size={14} strokeWidth={2}/> Use GPS
            </Button>
          </div>

          {/* Map */}
          <div className="relative">
            <div ref={mapDiv} style={{height:300,width:"100%"}}/>
            {!ready&&(
              <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2.5 bg-muted">
                <div style={{width:28,height:28,borderRadius:"50%",border:"3px solid var(--border)",borderTopColor:"#FFD600",animation:"spin 0.7s linear infinite"}}/>
                <span className="text-[12px] text-muted-foreground">Loading map…</span>
              </div>
            )}
          </div>

          {/* Save bar */}
          <div className="flex items-center gap-2.5 bg-card p-3 ps-4">
            <p className="m-0 flex-1 text-[11px] text-muted-foreground">Click map to pin · Drag to adjust</p>
            <Button
              onClick={save}
              disabled={pinLat==null||status==="saving"||status==="saved"}
              variant={status==="saved" ? "secondary" : "default"}
              size="sm"
              className={status==="saved" ? "text-[var(--green)]" : undefined}
            >
              {status==="saved"?<><Check size={14} strokeWidth={2}/>Saved!</>:status==="saving"?"Saving…":"Save location"}
            </Button>
          </div>
          {status==="error"&&<div className="bg-destructive/10 px-4 py-1.5 text-[12px] text-destructive">Failed to save. Try again.</div>}
        </div>
      )}
    </div>
  );
}
