# Map data and boundary policy

The world map is derived from Natural Earth through `world-atlas`. First-level
administrative boundaries for China, the United States, Russia, the United
Kingdom, France, Germany, and Japan are from geoBoundaries. Italian regions are
from `guglielmo/geojson-italy`, based on ISTAT data (CC BY 4.0).

Map geometry is presentation data, not the application's political model:

- Taiwan is represented as an independent, separately selectable map entity.
- The China ADM1 layer excludes Taiwan.
- The Russia ADM1 layer uses a pre-2022 dataset and excludes Ukrainian territory.
- ISO-coded overseas territories remain separately selectable where the world
  dataset provides separate geometry.

Sources:

- https://www.naturalearthdata.com/
- https://www.geoboundaries.org/
- https://github.com/guglielmo/geojson-italy
