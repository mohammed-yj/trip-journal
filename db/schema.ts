import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const audit = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
};

export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  originalName: text("original_name"),
  venueType: text("venue_type").notNull(),
  city: text("city").notNull(),
  regionOrState: text("region_or_state"),
  country: text("country").notNull(),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  officialUrl: text("official_url"),
  openingNotes: text("opening_notes"),
  generalNotes: text("general_notes"),
  personalImpression: text("personal_impression"),
  coverPhotoId: text("cover_photo_id"),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const exhibitions = sqliteTable("exhibitions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  venueId: text("venue_id").notNull(),
  exhibitionType: text("exhibition_type").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  officialUrl: text("official_url"),
  curatorOrOrganizer: text("curator_or_organizer"),
  description: text("description"),
  catalogueReference: text("catalogue_reference"),
  personalSummary: text("personal_summary"),
  coverPhotoId: text("cover_photo_id"),
  status: text("status").notNull(),
  verificationStatus: text("verification_status").notNull(),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const trips = sqliteTable("trips", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  cities: text("cities"),
  status: text("status").notNull(),
  planningNotes: text("planning_notes"),
  placesToVisit: text("places_to_visit"),
  researchQuestions: text("research_questions"),
  finalSummary: text("final_summary"),
  coverPhotoId: text("cover_photo_id"),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull(),
  visitDate: text("visit_date").notNull(),
  datePrecision: text("date_precision").notNull().default("day"),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  durationMinutes: integer("duration_minutes"),
  tripId: text("trip_id"),
  visitStatus: text("visit_status").notNull(),
  oneSentenceSummary: text("one_sentence_summary"),
  detailedNotes: text("detailed_notes"),
  highlights: text("highlights"),
  disappointments: text("disappointments"),
  unresolvedQuestions: text("unresolved_questions"),
  revisitIntention: text("revisit_intention").notNull(),
  practicalNotes: text("practical_notes"),
  coverPhotoId: text("cover_photo_id"),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const visitExhibitions = sqliteTable(
  "visit_exhibitions",
  {
    visitId: text("visit_id").notNull(),
    exhibitionId: text("exhibition_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.visitId, table.exhibitionId] })],
);

export const objectRecords = sqliteTable("object_records", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("未命名对象"),
  originalTitle: text("original_title"),
  objectType: text("object_type").notNull(),
  creator: text("creator"),
  cultureOrDynasty: text("culture_or_dynasty"),
  dateDisplay: text("date_display"),
  dateStart: integer("date_start"),
  dateEnd: integer("date_end"),
  material: text("material"),
  dimensions: text("dimensions"),
  provenance: text("provenance"),
  excavationLocation: text("excavation_location"),
  owningInstitution: text("owning_institution"),
  currentVenueId: text("current_venue_id"),
  exhibitionId: text("exhibition_id"),
  galleryOrRoom: text("gallery_or_room"),
  caseNumber: text("case_number"),
  caveOrBuildingNumber: text("cave_or_building_number"),
  labelTranscription: text("label_transcription"),
  personalObservation: text("personal_observation"),
  researchNotes: text("research_notes"),
  sourceLinks: text("source_links"),
  verificationStatus: text("verification_status").notNull(),
  coverPhotoId: text("cover_photo_id"),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const visitObjects = sqliteTable(
  "visit_objects",
  {
    visitId: text("visit_id").notNull(),
    objectId: text("object_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.visitId, table.objectId] })],
);

export const photoGroups = sqliteTable("photo_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  visitId: text("visit_id"),
  objectId: text("object_id"),
  coverPhotoId: text("cover_photo_id"),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const photoAssets = sqliteTable("photo_assets", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  shotAt: text("shot_at"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  caption: text("caption"),
  altText: text("alt_text"),
  photoType: text("photo_type").notNull(),
  photoGroupId: text("photo_group_id"),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const photoLinks = sqliteTable(
  "photo_links",
  {
    photoId: text("photo_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.photoId, table.entityType, table.entityId],
    }),
  ],
);

export const captures = sqliteTable("captures", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull(),
  captureType: text("capture_type").notNull(),
  textContent: text("text_content"),
  photoAssetId: text("photo_asset_id"),
  objectId: text("object_id"),
  exhibitionId: text("exhibition_id"),
  photoGroupId: text("photo_group_id"),
  capturedAt: text("captured_at").notNull(),
  processingStatus: text("processing_status").notNull(),
  isHighlight: integer("is_highlight").notNull().default(0),
  isDemo: integer("is_demo").notNull().default(0),
  ...audit,
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  tagType: text("tag_type").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const tagLinks = sqliteTable(
  "tag_links",
  {
    tagId: text("tag_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tagId, table.entityType, table.entityId],
    }),
  ],
);

export const tripVenues = sqliteTable(
  "trip_venues",
  {
    tripId: text("trip_id").notNull(),
    venueId: text("venue_id").notNull(),
    plannedStatus: text("planned_status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tripId, table.venueId] })],
);
