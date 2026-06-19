import React, { useState, useEffect, useRef } from 'react';
import { BorderPoint } from '../types';
import { Navigation, Plus, Trash2, MapPin, Minimize2, Eye, Compass, Info } from 'lucide-react';

interface MapPlannerProps {
  initialBorders: BorderPoint[];
  centerLat: number;
  centerLng: number;
  onSaveBorders: (points: BorderPoint[], lat: number, lng: number) => void;
  isLeader: boolean;
}

export default function MapPlanner({ 
  initialBorders, 
  centerLat, 
  centerLng, 
  onSaveBorders,
  isLeader 
}: MapPlannerProps) {
  const [points, setPoints] = useState<BorderPoint[]>(initialBorders);
  const [currentLat, setCurrentLat] = useState<number>(centerLat || 38.8977);
  const [currentLng, setCurrentLng] = useState<number>(centerLng || -77.0365);
  const [tracking, setTracking] = useState(false);
  const [scale, setScale] = useState(2.0); // pixels per meter
  const [message, setMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load geolocation on mount if not already provided
  useEffect(() => {
    if (!centerLat || !centerLng) {
      getLocation();
    }
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by your browser. Using preset coordinates.");
      return;
    }
    setTracking(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLat(latitude);
        setCurrentLng(longitude);
        setTracking(false);
        setMessage(`Satellite lock successful: [${latitude.toFixed(6)}, ${longitude.toFixed(6)}]`);
        
        // If they had no points, initialize a default square border of 10x10 meters
        if (points.length === 0) {
          const size = 0.0001; // roughly 10 meters
          const defaults: BorderPoint[] = [
            { lat: latitude - size, lng: longitude - size },
            { lat: latitude - size, lng: longitude + size },
            { lat: latitude + size, lng: longitude + size },
            { lat: latitude + size, lng: longitude - size },
          ];
          setPoints(defaults);
        }
      },
      (error) => {
        console.error(error);
        setTracking(false);
        setMessage("Unable to pinpoint exact satellite coordinates. Permitted framework preset used.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Convert GPS coordinate to relative pixel coordinates on Canvas
  // Center coordinate is mapped to canvas origin (center width/height)
  const gpsToPixels = (point: BorderPoint, width: number, height: number, centerLat: number, centerLng: number, scale: number) => {
    // 1 Degree Latitude ~ 111,000 meters
    const latDiffMeters = (point.lat - centerLat) * 111000;
    // 1 Degree Longitude ~ 111,000 * cos(lat) meters
    const radLat = (centerLat * Math.PI) / 180;
    const lngDiffMeters = (point.lng - centerLng) * 111000 * Math.cos(radLat);

    // X-axis: Longitude delta
    // Y-axis: Latitude delta (canvas Y grows downwards, so negate)
    const x = width / 2 + lngDiffMeters * scale;
    const y = height / 2 - latDiffMeters * scale;
    return { x, y };
  };

  // Convert relative pixel coordinate back to GPS
  const pixelsToGps = (x: number, y: number, width: number, height: number, centerLat: number, centerLng: number, scale: number) => {
    const lngDiffMeters = (x - width / 2) / scale;
    const latDiffMeters = -(y - height / 2) / scale;

    const latDelta = latDiffMeters / 111000;
    const radLat = (centerLat * Math.PI) / 180;
    const lngDelta = lngDiffMeters / (111000 * Math.cos(radLat));

    return {
      lat: centerLat + latDelta,
      lng: centerLng + lngDelta
    };
  };

  // Run canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Draw radar grids (rings representing meters)
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.08)'; // teal-500 very low opacity
    ctx.lineWidth = 1;

    // Outer range markers
    const distances = [5, 10, 25, 50, 100];
    distances.forEach(dist => {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, dist * scale, 0, 2 * Math.PI);
      ctx.stroke();

      // Label distances
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px monospace';
      ctx.fillText(`${dist}m`, width / 2 + dist * scale + 4, height / 2 + 3);
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.stroke();

    // Map Center (Capital point)
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#f43f5e'; // rose-500 (Capital location)
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw Borders Polygon if we have points
    if (points.length > 0) {
      const pixelCoords = points.map(p => gpsToPixels(p, width, height, currentLat, currentLng, scale));

      // Draw filled translucent background
      ctx.beginPath();
      ctx.moveTo(pixelCoords[0].x, pixelCoords[0].y);
      for (let i = 1; i < pixelCoords.length; i++) {
        ctx.lineTo(pixelCoords[i].x, pixelCoords[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(20, 184, 166, 0.15)'; // transparent teal
      ctx.fill();

      // Draw border stroke lines
      ctx.strokeStyle = '#14b8a6'; // teal-500
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw connection points
      pixelCoords.forEach((pt, index) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#14b8a6';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Draw vertex labels
        ctx.fillStyle = '#94a6b8';
        ctx.font = '10px monospace';
        ctx.fillText(`V${index + 1}`, pt.x + 9, pt.y - 4);
      });
    }

    // Compass direction indicator
    ctx.fillStyle = '#14b8a6';
    ctx.font = '11px sans-serif';
    ctx.fillText('N', width / 2 - 4, 18);
    ctx.fillText('S', width / 2 - 4, height - 8);
    ctx.fillText('W', 8, height / 2 + 4);
    ctx.fillText('E', width - 16, height / 2 + 4);

  }, [points, currentLat, currentLng, scale]);

  // Handle click on canvas to add state border vertices
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLeader) return; // Only leaders can draw borders
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPoint = pixelsToGps(x, y, canvas.width, canvas.height, currentLat, currentLng, scale);
    setPoints([...points, newPoint]);
    setMessage(`Added sector coordinate: [${newPoint.lat.toFixed(6)}, ${newPoint.lng.toFixed(6)}]`);
  };

  // Calculate polygon area using Shoelace formula
  const getMicroArea = () => {
    if (points.length < 3) return 0;
    
    // Convert GPS coordinates to local meters first for calculations
    const radLat = (currentLat * Math.PI) / 180;
    const localCoords = points.map(p => {
      return {
        x: (p.lng - currentLng) * 111000 * Math.cos(radLat),
        y: (p.lat - currentLat) * 111000
      };
    });

    let area = 0;
    const len = localCoords.length;
    for (let i = 0; i < len; i++) {
      const next = (i + 1) % len;
      area += (localCoords[i].x * localCoords[next].y) - (localCoords[next].x * localCoords[i].y);
    }
    return Math.abs(area / 2);
  };

  const handleClearBorders = () => {
    setPoints([]);
    setMessage("Borders cleared. Click on the grid to map new border checkpoints.");
  };

  const handleSave = () => {
    onSaveBorders(points, currentLat, currentLng);
    setMessage("State borders updated and synchronized with administrative database.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="border-planner-main">
      
      {/* Interactive Map Canvas column */}
      <div className="lg:col-span-2 space-y-4" id="map-canvas-container">
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-teal-400" />
              <h3 className="font-sans font-semibold text-white">Tactical Sovereignty Borders</h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <label htmlFor="scale-slider" className="text-slate-400">Zoom:</label>
              <input 
                id="scale-slider"
                type="range"
                min="0.5"
                max="8.0"
                step="0.1"
                className="w-24 accent-teal-400 cursor-pointer"
                value={scale} 
                onChange={(e) => setScale(parseFloat(e.target.value))} 
              />
              <span className="text-teal-400">{scale.toFixed(1)}x</span>
            </div>
          </div>

          <div className="relative overflow-hidden border border-slate-700 rounded-lg flex justify-center bg-slate-950" id="canvas-wrapper">
            <canvas 
              id="border-canvas"
              ref={canvasRef}
              width={540}
              height={400}
              onClick={handleCanvasClick}
              className={`max-w-full h-auto cursor-crosshair rounded-lg ${!isLeader ? 'pointer-events-none opacity-90' : ''}`}
            />
            
            {/* Legend inside canvas */}
            <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-700/60 rounded-md p-2.5 text-[11px] font-mono space-y-1 shadow-lg max-w-[200px]" id="canvas-overlay-labels">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white" />
                <span className="text-slate-200 font-semibold">Micro-Capital</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500/20 border border-teal-500 inline-block" />
                <span className="text-slate-200">Sovereign Soil</span>
              </div>
              <div className="text-slate-400 pt-1 text-[10px] leading-snug">
                Radius scales represent distance from GPS core.
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-3 bg-slate-900/60 border border-slate-700/40 text-[11px] font-mono p-2.5 rounded-lg text-slate-300 flex items-start gap-2" id="canvas-status-message">
              <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Console column */}
      <div className="space-y-4" id="border-controls-container">
        
        {/* State GPS Core coordinates details */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-4 shadow-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-2">
            <MapPin className="w-4 h-4 text-teal-400" />
            <h3 className="font-sans font-semibold text-white text-sm">Coordinates Core</h3>
          </div>

          <div className="grid grid-cols-2 gap-3" id="core-lat-lng-display">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Core Latitude</span>
              <span className="font-mono text-xs text-slate-200">{currentLat.toFixed(6)}° N</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Core Longitude</span>
              <span className="font-mono text-xs text-slate-200">{currentLng.toFixed(6)}° E</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono" id="gps-action-controls">
            <button 
              id="btn-re-lock-gps"
              type="button"
              onClick={getLocation}
              disabled={tracking}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-650 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              {tracking ? "Syncing..." : "Sync Real Location"}
            </button>
          </div>
        </div>

        {/* Territory and sovereign stats details */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-4 shadow-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700/40 pb-2">
            <Minimize2 className="w-4 h-4 text-teal-400" />
            <h3 className="font-sans font-semibold text-white text-sm">Territory Dimensions</h3>
          </div>

          <div className="space-y-2" id="territory-calculations">
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Mapped Vertices</span>
              <span className="font-mono text-sm text-teal-400 font-bold">{points.length} points</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Calculated Area</span>
              <span className="font-mono text-sm text-white font-bold">{getMicroArea().toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Scale Factor</span>
              <span className="font-mono text-[11px] text-slate-300">Countries smaller than a city</span>
            </div>
          </div>

          {isLeader ? (
            <div className="pt-2 space-y-2 border-t border-slate-700/40" id="leader-territory-actions">
              <button 
                id="btn-save-borders"
                type="button"
                onClick={handleSave}
                className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer text-center"
              >
                Inscribe Borders
              </button>
              <button 
                id="btn-clear-borders"
                type="button"
                onClick={handleClearBorders}
                className="w-full py-1.5 bg-slate-755 hover:bg-slate-700 hover:text-red-400 text-slate-400 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center"
              >
                Demolish Outline
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-center leading-relaxed" id="non-leader-notice">
              🔒 Demarcating micronation boundaries is restricted exclusively to the Sovereign.
            </div>
          )}
        </div>

        {/* Vertices List details panel */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-3.5 shadow-md">
          <span className="text-xs font-sans font-semibold text-slate-300 mb-2 block border-b border-slate-700/30 pb-1">Vertex Register</span>
          <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]" id="vertex-list-scroll">
            {points.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-900/80 p-1.5 rounded border border-slate-800" id={`vertex-row-${idx}`}>
                <span className="text-teal-400">Vertex #{idx + 1}</span>
                <span className="text-slate-300">{p.lat.toFixed(6)}°, {p.lng.toFixed(6)}°</span>
              </div>
            ))}
            {points.length === 0 && (
              <div className="text-slate-500 text-center py-4" id="empty-vertex-label">No boundaries registered. Tap the grid layout to start.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
