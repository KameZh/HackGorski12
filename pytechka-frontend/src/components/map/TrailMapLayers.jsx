import { Layer, Source } from 'react-map-gl/mapbox'
import {
  getTrailLayerIds,
  normalizeTrailGeojsonCollection,
} from './trailMapLayerUtils'

export default function TrailMapLayers({
  data,
  sourceId = 'pytechka-trails',
  layerPrefix = sourceId,
}) {
  const layerIds = getTrailLayerIds(layerPrefix)
  const sourceData = normalizeTrailGeojsonCollection(data)

  return (
    <Source id={sourceId} type="geojson" data={sourceData}>
      <Layer
        id={layerIds.unmarked}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'unmarked'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#000000',
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2],
        }}
      />

      <Layer
        id={layerIds.yellow}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'yellow'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#FFD700',
          'line-width': 2.5,
          'line-opacity': 0.9,
        }}
      />

      <Layer
        id={layerIds.green}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'green'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#22c55e',
          'line-width': 2.5,
          'line-opacity': 0.9,
        }}
      />

      <Layer
        id={layerIds.blue}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'blue'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#2563eb',
          'line-width': 2.5,
          'line-opacity': 0.9,
        }}
      />

      <Layer
        id={layerIds.whiteCasing}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'white'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#0f172a',
          'line-width': 4,
          'line-opacity': 0.95,
        }}
      />

      <Layer
        id={layerIds.whiteMain}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'white'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#ffffff',
          'line-width': 2.5,
          'line-opacity': 0.95,
        }}
      />

      <Layer
        id={layerIds.black}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'black'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#0f172a',
          'line-width': 3,
          'line-opacity': 0.92,
        }}
      />

      <Layer
        id={layerIds.red}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={[
          'all',
          ['==', ['get', 'colour_type'], 'red'],
          ['!=', ['get', 'source'], 'user'],
        ]}
        paint={{
          'line-color': '#dc2626',
          'line-width': 3,
          'line-opacity': 0.92,
        }}
      />

      <Layer
        id={layerIds.featuredCasing}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={['==', ['get', 'source'], 'osm_featured']}
        paint={{
          'line-color': '#0f172a',
          'line-width': 6,
          'line-opacity': 0.95,
        }}
      />

      <Layer
        id={layerIds.featuredMain}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={['==', ['get', 'source'], 'osm_featured']}
        paint={{
          'line-color': [
            'match',
            ['upcase', ['get', 'ref']],
            'E3',
            '#dc2626',
            'E4',
            '#2563eb',
            'E8',
            '#7c3aed',
            '#dc2626',
          ],
          'line-width': 4.5,
          'line-opacity': 0.98,
        }}
      />

      <Layer
        id={layerIds.user}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        filter={['==', ['get', 'source'], 'user']}
        paint={{
          'line-color': [
            'match',
            ['get', 'difficulty'],
            'easy',
            '#22c55e',
            'moderate',
            '#f97316',
            'hard',
            '#ef4444',
            'extreme',
            '#7f1d1d',
            '#64748b',
          ],
          'line-width': 3,
          'line-opacity': 0.94,
        }}
      />
    </Source>
  )
}
