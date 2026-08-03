# Map data and boundary policy

The world map is derived from Natural Earth through `world-atlas`. First-level
administrative boundaries for China, the United States, Russia, the United
Kingdom, France, Germany, and Japan are from geoBoundaries. Italian regions are
from `guglielmo/geojson-italy`, based on ISTAT data (CC BY 4.0).
The searchable city catalog and coordinates are generated from
`country-state-city` 3.2.1 (MIT) and split by country so the browser only loads
the selected country's list.

Map geometry is presentation data, not the application's political model:

- Taiwan is represented as an independent, separately selectable map entity.
- The China ADM1 layer excludes Taiwan.
- The Russia ADM1 layer uses a pre-2022 dataset and excludes Ukrainian territory.
- The Natural Earth world layer's Crimea polygon is reassigned from Russia to
  Ukraine at load time so the displayed sovereign boundary follows this policy.
- ISO-coded overseas territories remain separately selectable where the world
  dataset provides separate geometry.

Sources:

- https://www.naturalearthdata.com/
- https://www.geoboundaries.org/
- https://github.com/guglielmo/geojson-italy
- https://github.com/harpreetkhalsagtbit/country-state-city
