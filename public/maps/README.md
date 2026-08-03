# Map data and boundary policy

The world map is derived from Natural Earth through `world-atlas`. First-level
administrative boundaries for China, the United States, Russia, the United
Kingdom, France, Germany, and Japan are from geoBoundaries. Italian regions are
from `guglielmo/geojson-italy`, based on ISTAT data (CC BY 4.0).
The city dropdown and coordinates are generated from the GeoNames `cities500`,
`admin1CodesASCII`, and `admin2Codes` dumps (CC BY 4.0), then split by country.
For the eight detailed countries, every first-level region includes its capital
and three largest available cities. China additionally includes a representative
city for every second-level division so all prefecture-level cities are covered.

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
- https://download.geonames.org/export/dump/
