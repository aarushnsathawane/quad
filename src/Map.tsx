import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Person } from './types';
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const campusBounds: L.LatLngBoundsExpression = [
  [40.493, -74.464],
  [40.51, -74.438],
];
export default function CampusMap({
  people,
  selected,
  onSelect,
  mapRef,
}: {
  people: Person[];
  selected: string | null;
  onSelect: (p: Person) => void;
  mapRef: React.RefObject<L.Map | null>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    const map = L.map(element.current!, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 14,
      maxZoom: 18,
      zoomSnap: 0.5,
      scrollWheelZoom: true,
    }).setView([40.5015, -74.45], 15.5);
    L.imageOverlay('/campus.svg', campusBounds, { interactive: false }).addTo(map);
    map.setMaxBounds([
      [40.485, -74.477],
      [40.518, -74.426],
    ]);
    mapRef.current = map;
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(element.current!);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [mapRef]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    function draw() {
      layer.clearLayers();
      const groups: Person[][] = [];
      for (const p of people) {
        if (!p.position) continue;
        const point = map!.latLngToContainerPoint(p.position);
        const group = groups.find(
          (g) => point.distanceTo(map!.latLngToContainerPoint(g[0].position!)) < 55,
        );
        if (group) group.push(p);
        else groups.push([p]);
      }
      for (const group of groups) {
        const p = group[0];
        const cluster = group.length > 1;
        const chosen = group.some((x) => x.id === selected);
        const icon = L.divIcon({
          className: 'quad-marker',
          iconSize: [58, 70],
          iconAnchor: [29, 62],
          html: cluster
            ? `<button class="cluster-pin" aria-label="Zoom in on ${group.length} students"><img alt="" src="/avatars/${p.avatarStyle}.svg"/><strong>${group.length}</strong></button>`
            : `<button class="person-pin ${chosen ? 'selected' : ''}" aria-label="View ${escapeHtml(p.firstName)}'s profile"><img alt="" src="/avatars/${p.avatarStyle}.svg"/><span class="pin-dot"></span><span class="pin-name">${escapeHtml(p.firstName)}</span></button>`,
        });
        L.marker(p.position!, { icon, keyboard: false, zIndexOffset: chosen ? 1000 : 0 })
          .addTo(layer)
          .on('click', () => {
            if (cluster) {
              map!.setView(p.position!, Math.min(map!.getZoom() + 1.5, 18));
              if (map!.getZoom() >= 18) selectRef.current(p);
            } else selectRef.current(p);
          });
      }
    }
    draw();
    map.on('zoomend moveend', draw);
    return () => {
      map.off('zoomend moveend', draw);
      layer.remove();
    };
  }, [people, selected, mapRef]);
  return (
    <div
      className="map-canvas"
      ref={element}
      aria-label="Illustrated College Avenue campus map. Use the nearby list to browse accessible student profiles."
    />
  );
}
