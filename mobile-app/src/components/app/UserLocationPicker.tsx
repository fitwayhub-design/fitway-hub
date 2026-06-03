/**
 * UserLocationPicker
 * Simple one-tap location collector for user profiles.
 * Shows a mini Leaflet map with the user's current saved pin.
 * Saves lat/lng + city to /api/user/location.
 */
import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Check } from "lucide-react";
import { getApiBase } from "@/lib/api";

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
      await fetch(`${getApiBase()}/api/user/location`,{
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,214,0,0.1)",border:"1px solid rgba(255,214,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <MapPin size={17} color="#FFD600"/>
          </div>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:"var(--text-primary)"}}>My Location</p>
            <p style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>
              {status==="saved" ? "✅ Saved!" :
               pinCity ? `📍 ${pinCity}` :
               "Used to show nearby coaches & relevant ads"}
            </p>
          </div>
        </div>
        <button onClick={()=>setOpen(o=>!o)} style={{padding:"8px 16px",borderRadius:10,border:"1px solid #FFD600",background:open?"rgba(255,214,0,0.12)":"transparent",color:"#FFD600",fontWeight:600,fontSize:12,cursor:"pointer"}}>
          {open ? "Close" : pinCity ? "Update" : "Set location"}
        </button>
      </div>

      {open && (
        <div style={{marginTop:12,borderRadius:14,overflow:"hidden",border:"1px solid var(--border)",boxShadow:"0 4px 20px rgba(0,0,0,0.12)"}}>
          {/* Toolbar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--bg-card)",borderBottom:"1px solid var(--border)",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:12,color:"var(--text-secondary)"}}>
              {pinLat!=null ? <><strong style={{color:"#FFD600"}}>📍</strong> {pinCity||"Custom location"} ({pinLat.toFixed(3)}, {(pinLng??0).toFixed(3)})</> : "Click the map or use GPS to set your location"}
            </span>
            <button onClick={useGPS} disabled={status==="saving"} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,background:"rgba(255,214,0,0.1)",border:"1px solid #FFD600",color:"#FFD600",cursor:"pointer",fontSize:12,fontWeight:600}}>
              <Crosshair size={13}/> Use GPS
            </button>
          </div>

          {/* Map */}
          <div style={{position:"relative"}}>
            <div ref={mapDiv} style={{height:300,width:"100%"}}/>
            {!ready&&(
              <div style={{position:"absolute",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-surface)",flexDirection:"column",gap:10}}>
                <div style={{width:28,height:28,borderRadius:"50%",border:"3px solid var(--border)",borderTopColor:"#FFD600",animation:"spin 0.7s linear infinite"}}/>
                <span style={{fontSize:12,color:"var(--text-muted)"}}>Loading map…</span>
              </div>
            )}
          </div>

          {/* Save bar */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--bg-card)",borderTop:"1px solid var(--border)"}}>
            <p style={{flex:1,fontSize:11,color:"var(--text-muted)",margin:0}}>🖱️ Click map to pin · Drag to adjust</p>
            <button onClick={save} disabled={pinLat==null||status==="saving"||status==="saved"} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:10,background:status==="saved"?"rgba(0,200,100,0.15)":pinLat!=null?"#FFD600":"var(--bg-surface)",border:`1px solid ${status==="saved"?"rgba(0,200,100,0.4)":pinLat!=null?"#FFD600":"var(--border)"}`,color:status==="saved"?"#00C864":pinLat!=null?"#000":"var(--text-muted)",fontWeight:700,fontSize:13,cursor:pinLat!=null?"pointer":"not-allowed"}}>
              {status==="saved"?<><Check size={14}/>Saved!</>:status==="saving"?"Saving…":"Save location"}
            </button>
          </div>
          {status==="error"&&<div style={{padding:"6px 14px",background:"rgba(255,68,68,0.08)",fontSize:12,color:"var(--red,#FF4444)"}}>❌ Failed to save. Try again.</div>}
        </div>
      )}
    </div>
  );
}
