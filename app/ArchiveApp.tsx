"use client";

import {
  ChangeEvent,
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { intlLocale, Locale, translate } from "./i18n";
import LocationPicker from "./LocationPicker";
import TravelMap from "./TravelMap";

type Row = Record<string, any>;
type Snapshot = {
  schema_version: string;
  venues: Row[];
  exhibitions: Row[];
  visits: Row[];
  visit_exhibitions: Row[];
  objects: Row[];
  visit_objects: Row[];
  captures: Row[];
  photos: Row[];
  photo_links: Row[];
  photo_groups: Row[];
  trips: Row[];
  trip_venues: Row[];
  tags: Row[];
  tag_links: Row[];
  map_marks: Row[];
  trash: Row[];
};

const EMPTY: Snapshot = {
  schema_version: "1.1.0",
  venues: [],
  exhibitions: [],
  visits: [],
  visit_exhibitions: [],
  objects: [],
  visit_objects: [],
  captures: [],
  photos: [],
  photo_links: [],
  photo_groups: [],
  trips: [],
  trip_venues: [],
  tags: [],
  tag_links: [],
  map_marks: [],
  trash: [],
};

const mainNav = [
  ["home", "概览"],
  ["visits", "到访"],
  ["places", "地点"],
  ["exhibitions", "展览"],
  ["objects", "观察对象"],
  ["inbox", "整理收件箱"],
  ["trips", "旅程"],
  ["search", "搜索"],
  ["data", "设置与数据"],
] as const;

const photoLabels: Record<string, string> = {
  travel_scene: "旅行与城市",
  street: "街景",
  landscape: "自然景观",
  food: "饮食与日常",
  transport: "交通与路途",
  object_main: "作品主图",
  object_detail: "作品局部",
  label: "铭牌",
  gallery: "展厅",
  architecture: "建筑",
  environment: "环境",
  document: "图录与资料",
  other: "其他",
};

const objectTypes = [
  "街道与街景",
  "城市地标",
  "店铺与空间",
  "自然景观",
  "交通与路途",
  "城市细部",
  "绘画",
  "雕塑",
  "摄影",
  "装置",
  "手稿",
  "工艺品",
  "考古文物",
  "建筑构件",
  "壁画",
  "彩塑",
  "造像",
  "碑刻",
  "墓葬单元",
  "洞窟",
  "建筑",
  "庭院",
  "组合陈列",
  "其他",
];

const LocaleContext = createContext<Locale>("zh");

function useTranslate() {
  const locale = useContext(LocaleContext);
  return (key: string, variables: Record<string, string | number> = {}) =>
    translate(locale, key, variables);
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslate();
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`modal-sheet ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t("关闭")}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  const t = useTranslate();
  return (
    <div className="empty-state">
      <span className="archive-mark">{t("空")}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <button className="text-button" onClick={onAction}>
        {action} →
      </button>
    </div>
  );
}

function formatDate(value: string | undefined, precision: string | undefined, locale: Locale) {
  if (!value || value === "不确定") return translate(locale, "日期不确定");
  if (precision === "year") return value.slice(0, 4);
  if (precision === "month") {
    const [year, month] = value.slice(0, 7).split("-");
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: "numeric",
      month: "long",
    }).format(new Date(Number(year), Number(month) - 1, 1));
  }
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function durationText(minutes: number | undefined, locale: Locale) {
  if (minutes == null) return translate(locale, "时长未记录");
  if (minutes < 1) return translate(locale, "不足 1 分钟");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return translate(locale, "{minutes} 分钟", { minutes: rest });
  return rest
    ? translate(locale, "{hours} 小时 {minutes} 分", { hours, minutes: rest })
    : translate(locale, "{hours} 小时", { hours });
}

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = (rows.shift() ?? []).map((header) =>
    header.replace(/^\uFEFF/, "").trim(),
  );
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

export default function ArchiveApp() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [localeReady, setLocaleReady] = useState(false);
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("home");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState("");
  const [online, setOnline] = useState(true);
  const [tick, setTick] = useState(Date.now());
  const [liveDraft, setLiveDraft] = useState("");
  const [captureKind, setCaptureKind] = useState("文字速记");
  const [highlightNext, setHighlightNext] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [failedUpload, setFailedUpload] = useState<{
    files: File[];
    photoType: string;
  } | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroupPhotoIds, setSelectedGroupPhotoIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingGroupId, setPendingGroupId] = useState("");
  const [visitView, setVisitView] = useState("timeline");
  const [objectView, setObjectView] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("全部");
  const [inboxGroup, setInboxGroup] = useState("visit");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<Row | null>(null);
  const [importPreview, setImportPreview] = useState<{
    kind: "json" | "csv";
    archive?: Row;
    rows?: Row[];
    errors: string[];
  } | null>(null);
  const [theme, setTheme] = useState("light");
  const [objectFilters, setObjectFilters] = useState({
    object_type: "",
    culture_or_dynasty: "",
    material: "",
    verification_status: "",
  });
  const liveInputRef = useRef<HTMLTextAreaElement>(null);
  const t = (key: string, variables: Record<string, string | number> = {}) =>
    translate(locale, key, variables);

  const loadArchive = async () => {
    try {
      const response = await fetch("/api/archive", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(t(json.error || "读取失败"));
      setData(json);
      const ongoing = json.visits.find(
        (visit: Row) => visit.visit_status === "进行中",
      );
      if (ongoing) setActiveVisitId(ongoing.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("无法读取档案"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
    const updateNetwork = () => setOnline(navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    const savedTheme = localStorage.getItem("guanji-theme") || "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    const savedLocale = localStorage.getItem("guanji-locale");
    if (savedLocale === "zh" || savedLocale === "en" || savedLocale === "fr") {
      setLocale(savedLocale);
    }
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang =
      locale === "en" ? "en" : locale === "fr" ? "fr" : "zh-CN";
    if (localeReady) localStorage.setItem("guanji-locale", locale);
  }, [locale, localeReady]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeVisitId) return;
    const key = `guanji-draft-${activeVisitId}`;
    setLiveDraft(localStorage.getItem(key) || "");
  }, [activeVisitId]);

  useEffect(() => {
    if (!activeVisitId) return;
    const key = `guanji-draft-${activeVisitId}`;
    if (liveDraft) localStorage.setItem(key, liveDraft);
    else localStorage.removeItem(key);
  }, [activeVisitId, liveDraft]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const act = async (action: string, payload: Row = {}, quiet = false) => {
    setBusy(true);
    try {
      const response = await fetch("/api/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t(json.error || "保存失败"));
      setData(json.snapshot);
      if (!quiet) showToast(t("已保存到私人档案"));
      return json.result as Row;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("保存失败"));
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const venueMap = useMemo(
    () => new Map(data.venues.map((row) => [row.id, row])),
    [data.venues],
  );
  const exhibitionMap = useMemo(
    () => new Map(data.exhibitions.map((row) => [row.id, row])),
    [data.exhibitions],
  );
  const objectMap = useMemo(
    () => new Map(data.objects.map((row) => [row.id, row])),
    [data.objects],
  );
  const visitMap = useMemo(
    () => new Map(data.visits.map((row) => [row.id, row])),
    [data.visits],
  );
  const photoMap = useMemo(
    () => new Map(data.photos.map((row) => [row.id, row])),
    [data.photos],
  );

  const activeVisit =
    data.visits.find((visit) => visit.id === activeVisitId) ??
    data.visits.find((visit) => visit.visit_status === "进行中");
  const activeVenue = activeVisit
    ? venueMap.get(activeVisit.venue_id)
    : undefined;
  const activeExhibitionIds = activeVisit
    ? data.visit_exhibitions
        .filter((link) => link.visit_id === activeVisit.id)
        .map((link) => link.exhibition_id)
    : [];
  const activeExhibitions = activeExhibitionIds
    .map((id) => exhibitionMap.get(id))
    .filter(Boolean);
  const activeCaptures = activeVisit
    ? data.captures.filter((capture) => capture.visit_id === activeVisit.id)
    : [];

  const unprocessed = data.captures.filter(
    (capture) => capture.processing_status !== "已整理",
  );
  const favoriteObjectIds = data.tag_links
    .filter((link) => {
      const tag = data.tags.find((item) => item.id === link.tag_id);
      return tag?.name === "最喜欢" && link.entity_type === "object";
    })
    .map((link) => link.entity_id);
  const favoriteObjects = data.objects.filter((object) =>
    favoriteObjectIds.includes(object.id),
  );

  const annual = useMemo(() => {
    const year = String(new Date().getFullYear());
    const visits = data.visits.filter((visit) =>
      String(visit.visit_date).startsWith(year),
    );
    const venueIds = new Set(visits.map((visit) => visit.venue_id));
    const exhibitionIds = new Set(
      data.visit_exhibitions
        .filter((link) => visits.some((visit) => visit.id === link.visit_id))
        .map((link) => link.exhibition_id),
    );
    const objectIds = new Set(
      data.visit_objects
        .filter((link) => visits.some((visit) => visit.id === link.visit_id))
        .map((link) => link.object_id),
    );
    const cities = new Set(
      Array.from(venueIds)
        .map((id) => venueMap.get(id)?.city)
        .filter(Boolean),
    );
    return [
      ["参观", visits.length],
      ["地点", venueIds.size],
      ["展览", exhibitionIds.size],
      ["对象", objectIds.size],
      ["城市", cities.size],
    ];
  }, [data, venueMap]);

  const visitPhotos = (visitId: string) => {
    const ids = data.photo_links
      .filter(
        (link) =>
          link.entity_type === "visit" && link.entity_id === visitId,
      )
      .map((link) => link.photo_id);
    return data.photos.filter((photo) => ids.includes(photo.id));
  };

  const visitExhibitions = (visitId: string) =>
    data.visit_exhibitions
      .filter((link) => link.visit_id === visitId)
      .map((link) => exhibitionMap.get(link.exhibition_id))
      .filter(Boolean);

  const tagsFor = (entityType: string, entityId: string) => {
    const ids = data.tag_links
      .filter(
        (link) =>
          link.entity_type === entityType && link.entity_id === entityId,
      )
      .map((link) => link.tag_id);
    return data.tags.filter((tag) => ids.includes(tag.id));
  };

  const startVisit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let venueId = String(form.get("venue_id") || "");
    if (!venueId) {
      const result = await act(
        "createVenue",
        {
          name: form.get("venue_name"),
          venue_type: form.get("venue_type"),
          city: form.get("city"),
          country: form.get("country"),
          country_code: form.get("country_code"),
          country_name: form.get("country_name"),
          region_or_state: form.get("region_or_state"),
          admin1_code: form.get("admin1_code"),
          admin1_name: form.get("admin1_name"),
          latitude: form.get("latitude"),
          longitude: form.get("longitude"),
        },
        true,
      );
      venueId = result.id;
    }
    const chosenExhibitions = form
      .getAll("exhibition_ids")
      .map(String)
      .filter(Boolean);
    const newExhibition = String(form.get("new_exhibition") || "").trim();
    if (newExhibition) {
      const result = await act(
        "createExhibition",
        {
          title: newExhibition,
          venue_id: venueId,
          exhibition_type: "临时展",
          status: "已经参观",
        },
        true,
      );
      chosenExhibitions.push(result.id);
    }
    const result = await act("startVisit", {
      venue_id: venueId,
      exhibition_ids: chosenExhibitions,
      visit_date: localDateKey(),
      started_at: new Date().toISOString(),
    });
    setActiveVisitId(result.id);
    setModal("");
    setView("live");
  };

  const saveCapture = async () => {
    if (!activeVisit || !liveDraft.trim()) return;
    await act("createCapture", {
      visit_id: activeVisit.id,
      capture_type: captureKind,
      text_content: liveDraft,
      exhibition_id: activeExhibitionIds[0] || null,
      is_highlight: highlightNext,
    });
    setLiveDraft("");
    setHighlightNext(false);
    showToast(t("已保存到服务器"));
  };

  const uploadFiles = async (files: File[], photoType: string) => {
    if (!activeVisit || !files.length) return;
    if (!online) {
      setFailedUpload({ files, photoType });
      showToast(t("网络不可用；文件仍保留在本页，可稍后重试"));
      return;
    }
    setBusy(true);
    setUploadProgress(12);
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.set("visit_id", activeVisit.id);
    form.set("exhibition_id", activeExhibitionIds[0] || "");
    form.set("photo_type", photoType);
    form.set("is_highlight", highlightNext ? "1" : "0");
    try {
      setUploadProgress(45);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      setUploadProgress(85);
      const json = await response.json();
      if (!response.ok) throw new Error(t(json.error || "上传失败"));
      setData(json.snapshot);
      setFailedUpload(null);
      setHighlightNext(false);
      setUploadProgress(100);
      showToast(t("已保存 {count} 张原始照片", { count: files.length }));
      window.setTimeout(() => setUploadProgress(0), 700);
    } catch (error) {
      setFailedUpload({ files, photoType });
      setUploadProgress(0);
      showToast(t("{message}；可点击重试", {
        message: error instanceof Error ? error.message : t("上传失败"),
      }));
    } finally {
      setBusy(false);
    }
  };

  const createGroupFromSelection = async () => {
    if (!activeVisit || !selectedPhotoIds.size) return;
    const result = await act("createPhotoGroup", {
      name: `${activeVenue?.name || t("现场")} · ${new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date())}`,
      visit_id: activeVisit.id,
      photo_ids: Array.from(selectedPhotoIds),
    });
    setPendingGroupId(result.id);
    setSelectedPhotoIds(new Set());
    setModal("object");
  };

  const createObject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeVisit) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await act("createObject", {
      ...form,
      visit_id: activeVisit.id,
      current_venue_id: activeVisit.venue_id,
      exhibition_id: activeExhibitionIds[0] || null,
      photo_group_id: pendingGroupId || null,
    });
    setPendingGroupId("");
    setModal("");
  };

  const endVisit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeVisit) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await act("endVisit", { id: activeVisit.id, ...form });
    setActiveVisitId("");
    localStorage.removeItem(`guanji-draft-${activeVisit.id}`);
    setLiveDraft("");
    setModal("");
    setView("home");
  };

  const handleInboxBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const captureIds = Array.from(selectedCaptureIds);
    if (!captureIds.length) return;
    const form = new FormData(event.currentTarget);
    const selectedCaptures = data.captures.filter((capture) =>
      captureIds.includes(capture.id),
    );
    const photoIds = selectedCaptures
      .map((capture) => capture.photo_asset_id)
      .filter(Boolean);
    if (form.get("make_group") && photoIds.length) {
      await act(
        "createPhotoGroup",
        {
          name: String(form.get("group_name") || t("收件箱照片组")),
          visit_id:
            form.get("visit_id") || selectedCaptures[0]?.visit_id || null,
          object_id: form.get("object_id") || null,
          photo_ids: photoIds,
        },
        true,
      );
    }
    await act("batchOrganize", {
      capture_ids: captureIds,
      photo_ids: photoIds,
      visit_id: form.get("visit_id") || null,
      exhibition_id: form.get("exhibition_id") || null,
      object_id: form.get("object_id") || null,
      tag_name: form.get("tag_name") || null,
      mark_processed: Boolean(form.get("mark_processed")),
    });
    setSelectedCaptureIds(new Set());
  };

  const deleteObject = async (object: Row) => {
    if (!window.confirm(t("将“{title}”移入回收站？关联照片不会删除。", { title: object.title })))
      return;
    await act("softDelete", { entity_type: "object", id: object.id });
  };

  const readImport = async (
    event: ChangeEvent<HTMLInputElement>,
    kind: "json" | "csv",
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const body = await file.text();
    try {
      if (kind === "json") {
        const archive = JSON.parse(body);
        const errors: string[] = [];
        if (!["1.0.0", data.schema_version].includes(archive.schema_version)) {
          errors.push(t("版本不兼容：当前 {current}，文件 {file}", {
            current: data.schema_version,
            file: archive.schema_version || t("未知"),
          }));
        }
        setImportPreview({ kind, archive, errors });
      } else {
        const rows = parseCsv(body);
        const required = ["Venue 名称", "城市", "国家", "Visit 日期"];
        const errors = rows.flatMap((row, index) =>
          required
            .filter((field) => !String(row[field] || "").trim())
            .map((field) => t("第 {row} 行缺少“{field}”", { row: index + 2, field })),
        );
        setImportPreview({ kind, rows, errors });
      }
    } catch {
      setImportPreview({
        kind,
        errors: [t("无法读取文件，请确认格式正确。")],
      });
    }
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.errors.length) return;
    if (importPreview.kind === "json") {
      const result = await act("restoreJson", {
        archive: importPreview.archive,
      });
      showToast(t("已新增 {inserted} 条，跳过重复 {skipped} 条", {
        inserted: result.inserted,
        skipped: result.skipped,
      }));
    } else {
      const result = await act("importCsv", { rows: importPreview.rows });
      showToast(t("已导入 {count} 条历史参观", { count: result.imported }));
    }
    setImportPreview(null);
  };

  const currentYear = new Date().getFullYear();
  const elapsedMinutes =
    activeVisit?.started_at
      ? Math.max(
          0,
          Math.floor(
            (tick - new Date(activeVisit.started_at).getTime()) / 60000,
          ),
        )
      : 0;

  const renderHome = () => (
    <div className="page home-page">
      <header className="workbench-head">
        <div className="home-intro">
          <p className="eyebrow">
            {new Intl.DateTimeFormat(intlLocale(locale), {
              month: "long",
              day: "numeric",
              weekday: "long",
            }).format(new Date())}
          </p>
          <h1>{t("旅行与城市观察")}</h1>
          <p className="lede">
            {t("记录到访、街道、建筑、展览与所见之物，形成可检索、可迁移的私人档案。")}
          </p>
          <div className="home-primary-actions">
            <button className="home-trip-button" onClick={() => setModal("trip")}>
              <strong>{t("＋ 添加新旅程")}</strong>
              <span>→</span>
            </button>
            <button
              className="home-visit-link"
              onClick={() => {
                if (activeVisit) setView("live");
                else setModal("start");
              }}
              data-testid="start-visit"
            >
              {activeVisit ? t("继续这次记录") : t("新建到访记录")} →
            </button>
          </div>
        </div>
        <TravelMap
          locale={locale}
          venues={data.venues}
          visits={data.visits}
          trips={data.trips}
          mapMarks={data.map_marks || []}
          busy={busy}
          onAddMark={(payload) => act("addMapMark", payload)}
          onRemoveMark={(id) => act("removeMapMark", { id })}
        />
      </header>

      {activeVisit ? (
        <button className="ongoing-strip" onClick={() => setView("live")}>
          <span className="pulse" />
          <div>
            <small>{t("正在记录 · {minutes} 分钟", { minutes: elapsedMinutes })}</small>
            <strong>{activeVenue?.name}</strong>
          </div>
          <span>{t("{count} 条记录 →", { count: activeCaptures.length })}</span>
        </button>
      ) : null}

      {!data.visits.length && !data.venues.length ? (
        <section className="first-use">
          <div>
            <p className="section-number">{t("01 / 建立档案")}</p>
            <h2>{t("从一次真实经历开始")}</h2>
            <p>
              {t("不必先整理过去的一切。开始一次到访、补录一段旅行，或导入现有清单。")}
            </p>
          </div>
          <div className="first-actions">
            <button onClick={() => setModal("start")}>{t("开始第一次记录")}</button>
            <button onClick={() => setModal("history")}>{t("补录过去的旅行")}</button>
            <button onClick={() => setModal("trip")}>{t("创建旅行计划")}</button>
            <button onClick={() => setView("data")}>{t("导入 CSV")}</button>
          </div>
        </section>
      ) : null}

      <div className="home-grid">
        <section className="paper-section recent-section">
          <div className="section-head">
            <div>
              <p className="section-number">{t("02 / 最近")}</p>
              <h2>{t("最近记录")}</h2>
            </div>
            <button className="text-button" onClick={() => setView("visits")}>
              {t("查看全部")}
            </button>
          </div>
          {data.visits.length ? (
            <div className="visit-stack">
              {data.visits.slice(0, 3).map((visit, index) => {
                const venue = venueMap.get(visit.venue_id);
                const photos = visitPhotos(visit.id);
                return (
                  <article className="visit-row" key={visit.id}>
                    <div className="visit-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    {photos[0] ? (
                      <button
                        className="thumb"
                        onClick={() => setLightboxPhoto(photos[0])}
                      >
                        <img
                          src={`/api/photos/${photos[0].id}`}
                          alt={photos[0].alt_text || photos[0].caption || venue?.name}
                        />
                      </button>
                    ) : (
                      <div className="thumb thumb-placeholder">观</div>
                    )}
                    <div className="visit-copy">
                      <time>{formatDate(visit.visit_date, visit.date_precision, locale)}</time>
                      <h3>{venue?.name || t("未命名地点")}</h3>
                      <p>
                        {visit.one_sentence_summary ||
                          visitExhibitions(visit.id)
                            .map((item: any) => item.title)
                            .join("、") ||
                          t("这次参观还没有补充说明。")}
                      </p>
                    </div>
                    <div className="visit-meta">
                      <span>{t("{count} 照片", { count: photos.length })}</span>
                      <span>
                        {
                          data.captures.filter(
                            (capture) =>
                              capture.visit_id === visit.id &&
                              capture.processing_status !== "已整理",
                          ).length
                        }{" "}
                        {t("待整理")}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={t("还没有到访记录")}
              body={t("到达一个地点时，只需要选一个地点就能开始。")}
              action={t("开始第一次记录")}
              onAction={() => setModal("start")}
            />
          )}
        </section>

        <aside className="home-rail">
          <section className="inbox-card">
            <p className="section-number">{t("03 / 回家整理")}</p>
            <strong>{unprocessed.length}</strong>
            <h2>{t("待整理项目")}</h2>
            <p>
              {unprocessed.length
                ? t("零散照片、铭牌和速记正在这里等待归档。")
                : t("收件箱很干净。新的现场记录会自动来到这里。")}
            </p>
            <button onClick={() => setView("inbox")}>
              {t("打开整理收件箱 →")}
            </button>
          </section>
          <section className="quick-links">
            <button onClick={() => setModal("history")}>
              <span>{t("历史补录")}</span>
              <small>{t("年份或月份也可以")}</small>
              <b>＋</b>
            </button>
            <button onClick={() => setModal("trip")}>
              <span>{t("计划旅程")}</span>
              <small>{t("{count} 个进行中", { count: data.trips.filter((trip) => trip.status !== "已完成").length })}</small>
              <b>→</b>
            </button>
          </section>
        </aside>
      </div>

      <section className="rediscover">
        <div>
          <p className="section-number">{t("04 / 重新看看")}</p>
          <h2>{t("在旧记录里发现新的联系")}</h2>
        </div>
        <div className="rediscover-items">
          <button onClick={() => setView("search")}>
            <span className="archive-mark">{t("问")}</span>
            <strong>{t("尚未解决的问题")}</strong>
            <small>
              {
                data.visits.filter((visit) => visit.unresolved_questions)
                  .length
              }{" "}
              {t("条")}
            </small>
          </button>
          <button onClick={() => setView("objects")}>
            <span className="archive-mark">{t("藏")}</span>
            <strong>{t("标记为最喜欢")}</strong>
            <small>{t("{count} 件", { count: favoriteObjects.length })}</small>
          </button>
          <button onClick={() => setView("inbox")}>
            <span className="archive-mark">{t("照")}</span>
            <strong>{t("有照片但没有说明")}</strong>
            <small>
              {t("{count} 张", { count: data.photos.filter((photo) => !photo.caption).length })}
            </small>
          </button>
        </div>
      </section>

      <section className="annual-strip">
        <div>
          <p className="section-number">05 / {currentYear}</p>
          <h2>{t("今年的档案")}</h2>
        </div>
        <div className="annual-stats">
          {annual.map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{t(String(label))}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderVisits = () => {
    const grouped = data.visits.reduce<Record<string, Row[]>>((groups, visit) => {
      const key =
        visit.date_precision === "year"
          ? visit.visit_date.slice(0, 4)
          : visit.visit_date.slice(0, 7);
      groups[key] = [...(groups[key] || []), visit];
      return groups;
    }, {});
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Visits / {t("每一次进入")}</p>
            <h1>{t("参观")}</h1>
            <p>{t("每一次到访、散步或旅行停留，都保留为独立经历。")}</p>
          </div>
          <div className="head-actions">
            <button className="secondary" onClick={() => setModal("history")}>
              {t("历史补录")}
            </button>
            <button className="primary" onClick={() => setModal("start")}>
              {t("＋ 开始记录")}
            </button>
          </div>
        </header>
        <div className="view-controls">
          {[
            ["timeline", "时间线"],
            ["year", "年月分组"],
            ["list", "简洁列表"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={visitView === id ? "active" : ""}
              onClick={() => setVisitView(id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        {!data.visits.length ? (
          <EmptyState
            title={t("到访时间线还是空的")}
            body={t("开始一次现场记录，或从记得的年份慢慢补录。")}
            action={t("补录过去的旅行")}
            onAction={() => setModal("history")}
          />
        ) : visitView === "year" ? (
          <div className="year-groups">
            {Object.entries(grouped).map(([month, visits]) => (
              <section key={month}>
                <h2>{month.replace("-", " / ")}</h2>
                <div className="compact-list">
                  {visits.map((visit) => (
                    <VisitCompact key={visit.id} visit={visit} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={visitView === "list" ? "compact-list" : "timeline"}>
            {data.visits.map((visit) => (
              <VisitCompact key={visit.id} visit={visit} detailed={visitView === "timeline"} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const VisitCompact = ({
    visit,
    detailed = false,
  }: {
    visit: Row;
    detailed?: boolean;
  }) => {
    const venue = venueMap.get(visit.venue_id);
    const photos = visitPhotos(visit.id);
    const inboxCount = data.captures.filter(
      (capture) =>
        capture.visit_id === visit.id &&
        capture.processing_status !== "已整理",
    ).length;
    return (
      <article className={`visit-card ${detailed ? "detailed" : ""}`}>
        <div className="visit-date-block">
          <strong>{String(visit.visit_date).slice(8, 10) || "—"}</strong>
          <span>{String(visit.visit_date).slice(0, 7)}</span>
        </div>
        {detailed && photos[0] ? (
          <button className="visit-cover" onClick={() => setLightboxPhoto(photos[0])}>
            <img src={`/api/photos/${photos[0].id}`} alt={venue?.name || t("参观照片")} />
          </button>
        ) : null}
        <div className="visit-card-copy">
          <div className="kicker-row">
            <span>{venue?.city} · {venue?.venue_type}</span>
            <span className={`status status-${visit.visit_status}`}>
              {t(visit.visit_status)}
            </span>
          </div>
          <h2>{venue?.name || t("未命名地点")}</h2>
          <p className="exhibition-line">
            {visitExhibitions(visit.id)
              .map((item: any) => item.title)
              .join(" / ") || t("未关联展览")}
          </p>
          <p>{visit.one_sentence_summary || t("尚未填写一句话总结。")}</p>
          <div className="tag-line">
            {tagsFor("visit", visit.id).map((tag) => (
              <span key={tag.id}>#{tag.name}</span>
            ))}
          </div>
        </div>
        <div className="visit-card-meta">
          <span>{t("{count} 照片", { count: photos.length })}</span>
          <span>{t("{count} 待整理", { count: inboxCount })}</span>
          <span>{durationText(visit.duration_minutes, locale)}</span>
          <a href={`/api/export?format=md&type=visit&id=${visit.id}`}>
            {t("导出 Markdown")}
          </a>
        </div>
      </article>
    );
  };

  const renderPlaces = () => {
    const selectedVenue = venueMap.get(selectedVenueId);
    if (selectedVenue) {
      const venueVisits = data.visits.filter(
        (visit) => visit.venue_id === selectedVenue.id,
      );
      const venueExhibitions = data.exhibitions.filter(
        (exhibition) => exhibition.venue_id === selectedVenue.id,
      );
      return (
        <div className="page">
          <button
            className="back-link"
            onClick={() => setSelectedVenueId("")}
          >
            ← {t("返回地点")}
          </button>
          <header className="venue-detail-head">
            <div>
              <p className="eyebrow">
                {selectedVenue.country} / {selectedVenue.city} /{" "}
                {selectedVenue.venue_type}
              </p>
              <h1>{selectedVenue.name}</h1>
              {selectedVenue.original_name ? (
                <p className="original-title">{selectedVenue.original_name}</p>
              ) : null}
            </div>
            <div className="venue-detail-counts">
              <div>
                <strong>{venueVisits.length}</strong>
                <span>{t("次独立参观")}</span>
              </div>
              <div>
                <strong>{venueExhibitions.length}</strong>
                <span>{t("个展览")}</span>
              </div>
            </div>
          </header>
          <div className="venue-notes">
            <div>
              <h2>{t("整体印象")}</h2>
              <p>
                {selectedVenue.personal_impression ||
                  selectedVenue.general_notes ||
                  t("尚未填写。")}
              </p>
            </div>
            <div>
              <h2>{t("实用笔记")}</h2>
              <p>{selectedVenue.opening_notes || t("尚未填写。")}</p>
            </div>
          </div>
          <section className="venue-visits">
            <div className="region-head">
              <h2>{t("每一次参观")}</h2>
              <span>{t("照片与笔记按 Visit 分开保存")}</span>
            </div>
            <div className="timeline">
              {venueVisits.map((visit) => (
                <VisitCompact key={visit.id} visit={visit} detailed />
              ))}
            </div>
          </section>
          <section className="venue-exhibitions">
            <div className="region-head">
              <h2>{t("相关展览")}</h2>
              <span>{t("{count} 项", { count: venueExhibitions.length })}</span>
            </div>
            <div>
              {venueExhibitions.map((exhibition) => (
                <article key={exhibition.id}>
                  <span>{t(exhibition.exhibition_type)}</span>
                  <h3>{exhibition.title}</h3>
                  <small>{t(exhibition.status)}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      );
    }
    const places = data.venues.reduce<Record<string, Row[]>>((groups, venue) => {
      const key = `${venue.country} · ${venue.region_or_state || venue.city}`;
      groups[key] = [...(groups[key] || []), venue];
      return groups;
    }, {});
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Places / {t("地域档案")}</p>
            <h1>{t("城市与旅行地点")}</h1>
            <p>{t("博物馆、街区、建筑、自然与日常停留，都按国家、地区与城市归档。")}</p>
          </div>
          <button className="primary" onClick={() => setModal("venue")}>
            {t("＋ 新建地点")}
          </button>
        </header>
        {!data.venues.length ? (
          <EmptyState
            title={t("还没有地点")}
            body={t("博物馆、街区、城市街道、咖啡馆、建筑、自然与遗址都可以各自建档。")}
            action={t("新建第一个地点")}
            onAction={() => setModal("venue")}
          />
        ) : (
          <div className="place-groups">
            {Object.entries(places).map(([region, venues]) => (
              <section key={region}>
                <div className="region-head">
                  <h2>{region}</h2>
                  <span>{t("{count} 个地点", { count: venues.length })}</span>
                </div>
                <div className="place-list">
                  {venues.map((venue) => {
                    const visits = data.visits.filter(
                      (visit) => visit.venue_id === venue.id,
                    );
                    return (
                      <article key={venue.id}>
                        <span className="archive-mark">{venue.name.slice(0, 1)}</span>
                        <div>
                          <small>{venue.city} · {t(venue.venue_type)}</small>
                          <h3>{venue.name}</h3>
                          {venue.original_name ? <p>{venue.original_name}</p> : null}
                        </div>
                        <div>
                          <strong>{visits.length}</strong>
                        <span>{t("次到访")}</span>
                        </div>
                        <p>{venue.personal_impression || venue.general_notes || t("尚未写下整体印象。")}</p>
                        <button
                          className="place-open"
                          onClick={() => setSelectedVenueId(venue.id)}
                        >
                          {t("查看地点档案 →")}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExhibitions = () => {
    const states = ["已经参观", "计划参观", "希望再看", "错过"];
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Exhibitions / {t("自己添加的展览")}</p>
            <h1>{t("展览")}</h1>
            <p>{t("常设展、临时展、双年展与遗址中的固定展示都各自保留。")}</p>
          </div>
          <button className="primary" onClick={() => setModal("exhibition")}>
            {t("＋ 新建展览")}
          </button>
        </header>
        {!data.exhibitions.length ? (
          <EmptyState
            title={t("还没有展览记录")}
            body={t("这里只显示你亲自添加的展览，不抓取外部资讯。")}
            action={t("添加展览")}
            onAction={() => setModal("exhibition")}
          />
        ) : (
          <div className="exhibition-columns">
            {states.map((status) => (
              <section key={status}>
                <h2>
                  {t(status)}{" "}
                  <span>
                    {data.exhibitions.filter((item) => item.status === status).length}
                  </span>
                </h2>
                {data.exhibitions
                  .filter((item) => item.status === status)
                  .map((exhibition) => (
                    <article key={exhibition.id}>
                      <small>
                        {venueMap.get(exhibition.venue_id)?.name || t("未关联地点")}
                      </small>
                      <h3>{exhibition.title}</h3>
                      {exhibition.original_title ? (
                        <p className="original-title">{exhibition.original_title}</p>
                      ) : null}
                      <p>
                        {exhibition.start_date || t("日期未记录")}
                        {exhibition.end_date ? ` — ${exhibition.end_date}` : ""}
                      </p>
                      <div>
                        <span>{t(exhibition.exhibition_type)}</span>
                        <span>{t(exhibition.verification_status)}</span>
                      </div>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        )}
      </div>
    );
  };

  const filteredObjects = data.objects.filter((object) =>
    Object.entries(objectFilters).every(
      ([key, value]) =>
        !value ||
        String(object[key] || "")
          .toLowerCase()
          .includes(value.toLowerCase()),
    ),
  );

  const renderObjects = () => (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Objects / {t("所见之物")}</p>
          <h1>{t("观察对象")}</h1>
          <p>{t("展品、建筑、街景、店铺、自然与城市细部，都可以关联多次到访。")}</p>
        </div>
        <div className="head-actions">
          <button
            className={objectView === "grid" ? "secondary active" : "secondary"}
            onClick={() => setObjectView("grid")}
          >
            {t("图像网格")}
          </button>
          <button
            className={objectView === "list" ? "secondary active" : "secondary"}
            onClick={() => setObjectView("list")}
          >
            {t("信息列表")}
          </button>
        </div>
      </header>
      <div className="filter-bar">
        <select
          aria-label={t("对象类型")}
          value={objectFilters.object_type}
          onChange={(event) =>
            setObjectFilters({ ...objectFilters, object_type: event.target.value })
          }
        >
          <option value="">{t("全部类型")}</option>
          {objectTypes.map((item) => (
            <option key={item} value={item}>{t(item)}</option>
          ))}
        </select>
        <input
          aria-label={t("文化或朝代")}
          placeholder={t("文化 / 朝代")}
          value={objectFilters.culture_or_dynasty}
          onChange={(event) =>
            setObjectFilters({
              ...objectFilters,
              culture_or_dynasty: event.target.value,
            })
          }
        />
        <input
          aria-label={t("材料")}
          placeholder={t("材料")}
          value={objectFilters.material}
          onChange={(event) =>
            setObjectFilters({ ...objectFilters, material: event.target.value })
          }
        />
        <select
          aria-label={t("核实状态")}
          value={objectFilters.verification_status}
          onChange={(event) =>
            setObjectFilters({
              ...objectFilters,
              verification_status: event.target.value,
            })
          }
        >
          <option value="">{t("全部核实状态")}</option>
          {["现场铭牌", "用户输入", "待核实", "已核实"].map((value) => (
            <option value={value} key={value}>{t(value)}</option>
          ))}
        </select>
      </div>
      {!data.objects.length ? (
        <EmptyState
          title={t("还没有单独建档的观察对象")}
          body={t("现场可以只拍照片；回家后再从照片组创建建筑、街景、展品或其他观察对象。")}
          action={t("去整理收件箱")}
          onAction={() => setView("inbox")}
        />
      ) : (
        <div className={objectView === "grid" ? "object-grid" : "object-list"}>
          {filteredObjects.map((object) => {
            const cover = photoMap.get(object.cover_photo_id);
            return (
              <article className="object-card" key={object.id}>
                <button
                  className="object-image"
                  onClick={() => cover && setLightboxPhoto(cover)}
                  aria-label={cover ? t("查看 {title} 大图", { title: object.title }) : object.title}
                >
                  {cover ? (
                    <img
                      src={`/api/photos/${cover.id}`}
                      alt={cover.alt_text || object.title}
                    />
                  ) : (
                    <span>{object.object_type.slice(0, 1)}</span>
                  )}
                  <i>{t(object.verification_status)}</i>
                </button>
                <div className="object-copy">
                  <small>
                    {object.culture_or_dynasty || t("时代未记录")} ·{" "}
                    {t(object.object_type)}
                  </small>
                  <h2>{object.title}</h2>
                  {object.original_title ? <p>{object.original_title}</p> : null}
                  <dl>
                    <div>
                      <dt>{t("作者 / 背景")}</dt>
                      <dd>{object.creator || object.culture_or_dynasty || t("未填写")}</dd>
                    </div>
                    <div>
                      <dt>{t("年代 / 材料")}</dt>
                      <dd>
                        {[object.date_display, object.material]
                          .filter(Boolean)
                          .join(" · ") || t("未填写")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("地点")}</dt>
                      <dd>
                        {venueMap.get(object.current_venue_id)?.name || t("未关联")}
                      </dd>
                    </div>
                  </dl>
                  <p className="observation">
                    {object.personal_observation || t("尚未写下现场观察。")}
                  </p>
                  <div className="tag-line">
                    {tagsFor("object", object.id).map((tag) => (
                      <span key={tag.id}>#{tag.name}</span>
                    ))}
                  </div>
                  <div className="card-actions">
                    <a href={`/api/export?format=md&type=object&id=${object.id}`}>
                      {t("导出")}
                    </a>
                    <button onClick={() => deleteObject(object)}>{t("移入回收站")}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderInbox = () => {
    const grouped = unprocessed.reduce<Record<string, Row[]>>((groups, capture) => {
      const key =
        inboxGroup === "type"
          ? capture.capture_type
          : inboxGroup === "problem"
            ? capture.photo_asset_id
              ? capture.object_id
                ? "已关联对象，待确认"
                : capture.capture_type === "铭牌照片"
                  ? "铭牌尚未关联对象"
                  : "照片尚未关联对象"
              : "一句速记尚未归类"
            : venueMap.get(visitMap.get(capture.visit_id)?.venue_id)?.name ||
              "未知参观";
      groups[key] = [...(groups[key] || []), capture];
      return groups;
    }, {});
    return (
      <div className="page inbox-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Inbox / {t("连续整理")}</p>
            <h1>
              {t("整理收件箱")} <sup>{unprocessed.length}</sup>
            </h1>
            <p>{t("选择一批素材后一次完成关联、成组、加标签与标记。")}</p>
          </div>
          <div className="head-actions">
            <span className="save-state">{t("自动保持当前位置")}</span>
          </div>
        </header>
        <div className="view-controls">
          {[
            ["visit", "按参观"],
            ["type", "按类型"],
            ["problem", "按问题"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={inboxGroup === id ? "active" : ""}
              onClick={() => setInboxGroup(id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        {!unprocessed.length ? (
          <EmptyState
            title={t("收件箱已整理完")}
            body={t("新的现场照片与速记会自动出现在这里。")}
            action={t("回到首页")}
            onAction={() => setView("home")}
          />
        ) : (
          <>
            <div className="inbox-groups">
              {Object.entries(grouped).map(([group, captures]) => (
                <section key={group}>
                  <div className="region-head">
                    <h2>{t(group)}</h2>
                    <span>{t("{count} 项", { count: captures.length })}</span>
                  </div>
                  <div className="capture-grid">
                    {captures.map((capture) => {
                      const photo = photoMap.get(capture.photo_asset_id);
                      const checked = selectedCaptureIds.has(capture.id);
                      return (
                        <label
                          className={`capture-card ${checked ? "selected" : ""}`}
                          key={capture.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const next = new Set(selectedCaptureIds);
                              if (event.target.checked) next.add(capture.id);
                              else next.delete(capture.id);
                              setSelectedCaptureIds(next);
                            }}
                          />
                          {photo ? (
                            <img
                              src={`/api/photos/${photo.id}`}
                              alt={photo.alt_text || photo.caption || capture.capture_type}
                            />
                          ) : (
                            <div className="text-capture">
                              “{capture.text_content || t("无文字内容")}”
                            </div>
                          )}
                          <div>
                            <strong>{t(capture.capture_type)}</strong>
                            <small>{formatDate(capture.captured_at, undefined, locale)}</small>
                            <span>
                              {capture.object_id
                                ? objectMap.get(capture.object_id)?.title
                                : t("未关联对象")}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {selectedCaptureIds.size ? (
              <form className="batch-bar" onSubmit={handleInboxBatch}>
                <strong>{t("{count} 项已选择", { count: selectedCaptureIds.size })}</strong>
                <select name="visit_id" aria-label={t("批量关联参观")}>
                  <option value="">{t("保留原参观")}</option>
                  {data.visits.map((visit) => (
                    <option value={visit.id} key={visit.id}>
                      {venueMap.get(visit.venue_id)?.name} · {visit.visit_date} ·{" "}
                      {visit.one_sentence_summary ||
                        visitExhibitions(visit.id)
                          .map((item: any) => item.title)
                          .join("、") ||
                        t("无说明")}
                    </option>
                  ))}
                </select>
                <select name="exhibition_id" aria-label={t("批量关联展览")}>
                  <option value="">{t("不更改展览")}</option>
                  {data.exhibitions.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <select name="object_id" aria-label={t("关联已有对象")}>
                  <option value="">{t("不关联对象")}</option>
                  {data.objects.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <input name="tag_name" placeholder={t("添加标签")} />
                <label className="check-label">
                  <input type="checkbox" name="make_group" /> {t("组成照片组")}
                </label>
                <input name="group_name" placeholder={t("照片组名称")} />
                <label className="check-label">
                  <input type="checkbox" name="mark_processed" defaultChecked />{" "}
                  {t("标记已整理")}
                </label>
                <button className="primary" type="submit" disabled={busy}>
                  {t("应用并继续")}
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
    );
  };

  const renderTrips = () => (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Trips / {t("行前到行后")}</p>
          <h1>{t("旅程")}</h1>
          <p>{t("把计划地点、研究问题、实际参观与行后总结放在一起。")}</p>
        </div>
        <button className="primary" onClick={() => setModal("trip")}>
          {t("＋ 创建旅程")}
        </button>
      </header>
      {!data.trips.length ? (
        <EmptyState
          title={t("还没有旅程计划")}
          body={t("可以从一座城市、一个主题或一组研究问题开始。")}
          action={t("创建第一个旅程")}
          onAction={() => setModal("trip")}
        />
      ) : (
        <div className="trip-list">
          {data.trips.map((trip, index) => {
            const visits = data.visits.filter((visit) => visit.trip_id === trip.id);
            return (
              <article key={trip.id}>
                <div className="trip-number">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="kicker-row">
                    <span>{t(trip.status)}</span>
                    <span>
                      {trip.start_date || t("日期未定")}
                      {trip.end_date ? ` — ${trip.end_date}` : ""}
                    </span>
                  </div>
                  <h2>{trip.name}</h2>
                  <p className="trip-cities">{trip.cities || t("城市待定")}</p>
                  <div className="trip-columns">
                    <div>
                      <h3>{t("计划地点")}</h3>
                      <p>{trip.places_to_visit || t("尚未添加")}</p>
                    </div>
                    <div>
                      <h3>{t("行前问题")}</h3>
                      <p>{trip.research_questions || t("尚未添加")}</p>
                    </div>
                    <div>
                      <h3>{t("已经完成")}</h3>
                      <p>{t("{count} 次参观", { count: visits.length })}</p>
                    </div>
                  </div>
                  {trip.planning_notes ? <blockquote>{trip.planning_notes}</blockquote> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const tagsByEntity = (type: string, id: string) =>
      tagsFor(type, id)
        .map((tag) => tag.name)
        .join(" ");
    const collections = [
      {
        type: "地点",
        rows: data.venues,
        title: (row: Row) => row.name,
        body: (row: Row) =>
          [
            row.original_name,
            row.city,
            row.region_or_state,
            row.country,
            row.general_notes,
            row.personal_impression,
            tagsByEntity("venue", row.id),
          ].join(" "),
      },
      {
        type: "展览",
        rows: data.exhibitions,
        title: (row: Row) => row.title,
        body: (row: Row) =>
          [row.original_title, row.description, row.personal_summary].join(" "),
      },
      {
        type: "参观",
        rows: data.visits,
        title: (row: Row) => venueMap.get(row.venue_id)?.name || "一次参观",
        body: (row: Row) =>
          [
            row.visit_date,
            row.one_sentence_summary,
            row.detailed_notes,
            row.highlights,
            row.unresolved_questions,
            tagsByEntity("visit", row.id),
          ].join(" "),
      },
      {
        type: "对象",
        rows: data.objects,
        title: (row: Row) => row.title,
        body: (row: Row) =>
          [
            row.original_title,
            row.object_type,
            row.creator,
            row.culture_or_dynasty,
            row.date_display,
            row.material,
            row.provenance,
            row.excavation_location,
            row.label_transcription,
            row.personal_observation,
            row.research_notes,
            tagsByEntity("object", row.id),
          ].join(" "),
      },
      {
        type: "现场记录",
        rows: data.captures,
        title: (row: Row) => row.capture_type,
        body: (row: Row) =>
          [row.text_content, tagsByEntity("capture", row.id)].join(" "),
      },
      {
        type: "旅程",
        rows: data.trips,
        title: (row: Row) => row.name,
        body: (row: Row) =>
          [
            row.cities,
            row.planning_notes,
            row.places_to_visit,
            row.research_questions,
            row.final_summary,
          ].join(" "),
      },
    ];
    return collections.flatMap((collection) =>
      collection.rows
        .filter(
          (row) =>
            `${collection.title(row)} ${collection.body(row)}`
              .toLowerCase()
              .includes(query) &&
            (searchType === "全部" || searchType === collection.type),
        )
        .map((row) => ({
          ...row,
          result_type: collection.type,
          result_title: collection.title(row),
          result_body: collection.body(row),
        }) as Row),
    );
  }, [searchQuery, searchType, data]);

  const renderSearch = () => (
    <div className="page search-page">
      <header className="search-head">
        <p className="eyebrow">Search / {t("全文检索")}</p>
        <h1>{t("重新找到当时看见的东西")}</h1>
        <label>
          <span>⌕</span>
          <input
            data-testid="global-search"
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("例如：北魏、彩塑、山西、青铜、待查资料")}
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery("")}>{t("清除")}</button>
          ) : null}
        </label>
        <div className="search-types">
          {["全部", "地点", "展览", "参观", "对象", "现场记录", "旅程"].map(
            (type) => (
              <button
                key={type}
                className={searchType === type ? "active" : ""}
                onClick={() => setSearchType(type)}
              >
                {t(type)}
              </button>
            ),
          )}
        </div>
      </header>
      {!searchQuery ? (
        <div className="search-prompts">
          <p>{t("从这些常用线索开始")}</p>
          {[
            "北魏",
            "粟特",
            "彩塑",
            "石窟",
            "象神",
            "贾科梅蒂",
            "青铜",
            "山西",
            "看不懂",
            "想再看",
          ].map((query) => (
            <button key={query} onClick={() => setSearchQuery(query)}>
              {query}
            </button>
          ))}
        </div>
      ) : (
        <div className="search-results">
          <p>
            {t("找到 {count} 条结果", { count: searchResults.length })}
          </p>
          {searchResults.map((result) => (
            <article key={`${result.result_type}-${result.id}`}>
              <span>{t(result.result_type)}</span>
              <div>
                <h2>{result.result_title}</h2>
                <p>
                  {String(result.result_body)
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 220) || t("无更多文字说明")}
                </p>
              </div>
              <time>
                {formatDate(result.updated_at || result.created_at, undefined, locale)}
              </time>
            </article>
          ))}
          {!searchResults.length ? (
            <EmptyState
              title={t("没有找到匹配记录")}
              body={t("可以换一个材料、时代、地点、主题或自己的笔记词语。")}
              action={t("清除搜索")}
              onAction={() => setSearchQuery("")}
            />
          ) : null}
        </div>
      )}
    </div>
  );

  const renderArchive = () => (
    <div className="page archive-hub">
      <header className="page-head">
        <div>
          <p className="eyebrow">Archive / {t("多种路径")}</p>
          <h1>{t("档案")}</h1>
          <p>{t("从地点、展览、对象与旅程进入同一组真实记录。")}</p>
        </div>
      </header>
      <div className="archive-doors">
        {[
          ["places", "地点视图", "按国家、地区、城市和场馆", data.venues.length],
          ["exhibitions", "展览视图", "已看过、计划去与希望再看", data.exhibitions.length],
          ["objects", "主题与对象", "按类型、朝代、材料和标签", data.objects.length],
          ["trips", "旅程视图", "行前问题、现场记录与行后总结", data.trips.length],
        ].map(([target, title, description, count]) => (
          <button key={String(target)} onClick={() => setView(String(target))}>
            <span>{String(title).slice(0, 1)}</span>
            <div>
            <h2>{t(String(title))}</h2>
            <p>{t(String(description))}</p>
            </div>
            <strong>{count}</strong>
          </button>
        ))}
      </div>
    </div>
  );

  const renderData = () => {
    const totalBytes = data.photos.reduce(
      (sum, photo) => sum + Number(photo.file_size || 0),
      0,
    );
    const demoCount = [
      ...data.venues,
      ...data.visits,
      ...data.objects,
      ...data.trips,
    ].filter((row) => row.is_demo).length;
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Data / {t("可迁移的私人档案")}</p>
            <h1>{t("设置与数据")}</h1>
            <p>{t("导出真实文件、恢复备份、管理演示记录与回收站。")}</p>
          </div>
          <span className="privacy-stamp">{t("仅所有者可访问")}</span>
        </header>
        <div className="settings-grid">
          <section>
            <div className="section-head">
              <div>
                <p className="section-number">01</p>
                <h2>{t("导出")}</h2>
              </div>
            </div>
            <p>
              {t("JSON 包含全部结构化数据、关系与照片清单；原始照片不嵌入其中，因此不把它称为完整照片备份。")}
            </p>
            <div className="download-list">
              <a data-testid="export-json" href="/api/export?format=json">
                <div>
                  <strong>{t("完整 JSON 数据")}</strong>
                  <small>{t("结构化数据、关系、标签、照片元数据")}</small>
                </div>
                <span>{t("下载 .json")}</span>
              </a>
              {[
                ["visits", "参观"],
                ["venues", "地点"],
                ["exhibitions", "展览"],
                ["objects", "观察对象"],
                ["trips", "旅程"],
                ["photos", "照片清单"],
              ].map(([type, label]) => (
                <a key={type} href={`/api/export?format=csv&type=${type}`}>
                  <div>
                    <strong>{t(label)} CSV</strong>
                    <small>{t("可在电子表格中继续整理")}</small>
                  </div>
                  <span>{t("下载 .csv")}</span>
                </a>
              ))}
              {data.visits[0] ? (
                <a
                  data-testid="export-markdown"
                  href={`/api/export?format=md&type=visit&id=${data.visits[0].id}`}
                >
                  <div>
                    <strong>{t("最近一次参观 Markdown")}</strong>
                    <small>{t("标题、日期、关系、笔记与照片文件名")}</small>
                  </div>
                  <span>{t("下载 .md")}</span>
                </a>
              ) : null}
            </div>
            {data.photos.length ? (
              <details className="photo-manifest">
                <summary>{t("逐张下载原始照片（{count}）", { count: data.photos.length })}</summary>
                {data.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={`/api/photos/${photo.id}`}
                    download={photo.original_filename}
                  >
                    {photo.original_filename} · {t(photoLabels[photo.photo_type])}
                  </a>
                ))}
              </details>
            ) : null}
          </section>

          <section>
            <div className="section-head">
              <div>
                <p className="section-number">02</p>
                <h2>{t("导入与恢复")}</h2>
              </div>
            </div>
            <p>{t("导入前先预览条数与错误；已有相同 ID 的记录不会被静默覆盖。")}</p>
            <div className="import-actions">
              <label>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => readImport(event, "json")}
                />
                <strong>{t("恢复观迹 JSON")}</strong>
                <small>{t("验证 schema_version 和重复 ID")}</small>
              </label>
              <label>
                <input
                  type="file"
                  accept="text/csv,.csv"
                  onChange={(event) => readImport(event, "csv")}
                />
                <strong>{t("批量导入历史参观")}</strong>
                <small>{t("先显示预览与逐行错误")}</small>
              </label>
              <a href="/api/export?format=template">{t("下载 CSV 导入模板")}</a>
            </div>
          </section>

          <section>
            <div className="section-head">
              <div>
                <p className="section-number">03</p>
                <h2>{t("存储与隐私")}</h2>
              </div>
            </div>
            <dl className="storage-stats">
              <div>
                <dt>{t("结构化记录")}</dt>
                <dd>
                  {data.venues.length +
                    data.exhibitions.length +
                    data.visits.length +
                    data.objects.length +
                    data.captures.length}
                </dd>
              </div>
              <div>
                <dt>{t("原始照片")}</dt>
                <dd>{data.photos.length}</dd>
              </div>
              <div>
                <dt>{t("照片占用")}</dt>
                <dd>
                  {totalBytes > 1024 * 1024
                    ? `${(totalBytes / 1024 / 1024).toFixed(1)} MB`
                    : `${Math.round(totalBytes / 1024)} KB`}
                </dd>
              </div>
            </dl>
            <p className="privacy-note">
              {t("档案通过平台所有者身份保护。照片只在你主动上传时写入对象存储，不会自动发给第三方，也不会在后台识别。")}
            </p>
          </section>

          <section>
            <div className="section-head">
              <div>
                <p className="section-number">04</p>
                <h2>{t("界面偏好")}</h2>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <strong>{t("主题模式")}</strong>
                <small>{t("浅色与深色都保留完整功能")}</small>
              </div>
              <select
                value={theme}
                onChange={(event) => {
                  const value = event.target.value;
                  setTheme(value);
                  localStorage.setItem("guanji-theme", value);
                  document.documentElement.dataset.theme = value;
                }}
              >
                <option value="light">{t("浅色")}</option>
                <option value="dark">{t("深色")}</option>
              </select>
            </div>
            <div className="setting-row">
              <div>
                <strong>{t("语言与日期")}</strong>
                <small>{t("简体中文 · 中文本地日期格式")}</small>
              </div>
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </section>

          <section>
            <div className="section-head">
              <div>
                <p className="section-number">05</p>
                <h2>{t("演示数据")}</h2>
              </div>
            </div>
            <p>{t("演示记录始终标有“示例”，与真实数据分开，可随时一次删除。")}</p>
            {demoCount ? (
              <button
                className="danger-outline"
                onClick={async () => {
                  if (
                    window.confirm(
                      t("删除全部演示记录和演示照片？你的真实档案不会受影响。"),
                    )
                  )
                    await act("clearDemo");
                }}
              >
                {t("删除全部演示数据（{count}）", { count: demoCount })}
              </button>
            ) : (
              <button className="secondary" onClick={() => act("seedDemo")}>
                {t("查看独立演示")}
              </button>
            )}
          </section>

          <section>
            <div className="section-head">
              <div>
                <p className="section-number">06</p>
                <h2>{t("回收站")}</h2>
              </div>
            </div>
            {data.trash.length ? (
              <>
                <div className="trash-list">
                  {data.trash.map((item) => (
                    <div key={`${item.entity_type}-${item.id}`}>
                      <span>
                        {item.title || item.name || item.one_sentence_summary || t("已删除记录")}
                      </span>
                      <small>{formatDate(item.deleted_at, undefined, locale)}</small>
                      <button
                        onClick={() =>
                          act("restore", {
                            entity_type: item.entity_type,
                            id: item.id,
                          })
                        }
                      >
                        {t("恢复")}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="danger-outline trash-empty"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        t("清空回收站会永久删除其中记录与已删除照片原文件。是否继续？"),
                      )
                    )
                      return;
                    if (
                      !window.confirm(
                        t("这是最后一次确认：清空后无法恢复。确定永久删除？"),
                      )
                    )
                      return;
                    await act("emptyTrash");
                  }}
                >
                  {t("清空回收站")}
                </button>
              </>
            ) : (
              <p className="muted">{t("回收站为空。删除的记录会先来到这里。")}</p>
            )}
          </section>

          <section className="group-manager">
            <div className="section-head">
              <div>
                <p className="section-number">07</p>
                <h2>{t("照片组管理")}</h2>
              </div>
            </div>
            <p>{t("可以把选中照片移出当前组，或将两个照片组合并；原始文件不会被改写。")}</p>
            {data.photo_groups.length ? (
              <div className="group-manager-list">
                {data.photo_groups.map((group) => {
                  const photos = data.photos.filter(
                    (photo) => photo.photo_group_id === group.id,
                  );
                  const selectedHere = photos
                    .map((photo) => photo.id)
                    .filter((id) => selectedGroupPhotoIds.has(id));
                  return (
                    <article key={group.id}>
                      <div>
                        <strong>{group.name}</strong>
                        <small>
                          {t("{count} 张", { count: photos.length })} ·{" "}
                          {group.object_id
                            ? objectMap.get(group.object_id)?.title || t("已关联对象")
                            : t("未关联对象")}
                        </small>
                      </div>
                      <div className="group-photo-picks">
                        {photos.map((photo) => (
                          <label key={photo.id}>
                            <input
                              type="checkbox"
                              aria-label={t("选择 {filename} 拆分", { filename: photo.original_filename })}
                              checked={selectedGroupPhotoIds.has(photo.id)}
                              onChange={(event) => {
                                const next = new Set(selectedGroupPhotoIds);
                                if (event.target.checked) next.add(photo.id);
                                else next.delete(photo.id);
                                setSelectedGroupPhotoIds(next);
                              }}
                            />
                            <img
                              src={`/api/photos/${photo.id}`}
                              alt={photo.caption || photo.original_filename}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="group-actions">
                        <button
                          className="secondary"
                          disabled={!selectedHere.length}
                          onClick={async () => {
                            await act("splitPhotoGroup", {
                              group_id: group.id,
                              photo_ids: selectedHere,
                            });
                            setSelectedGroupPhotoIds(new Set());
                          }}
                        >
                          {t("移出已选照片")}
                        </button>
                        {data.photo_groups.length > 1 ? (
                          <form
                            onSubmit={async (event) => {
                              event.preventDefault();
                              const targetId = String(
                                new FormData(event.currentTarget).get("target_id") ||
                                  "",
                              );
                              if (!targetId) return;
                              await act("mergePhotoGroups", {
                                source_id: group.id,
                                target_id: targetId,
                              });
                            }}
                          >
                            <select
                              name="target_id"
                              aria-label={t("选择“{name}”的合并目标", { name: group.name })}
                              defaultValue=""
                            >
                              <option value="">{t("选择合并目标")}</option>
                              {data.photo_groups
                                .filter((item) => item.id !== group.id)
                                .map((item) => (
                                  <option value={item.id} key={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                            </select>
                            <button className="secondary">{t("合并此组")}</button>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="muted">{t("还没有照片组。可在现场或收件箱中选择多张照片创建。")}</p>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderLive = () => {
    if (!activeVisit || !activeVenue) {
      return (
        <div className="page">
          <EmptyState
            title={t("没有正在进行的记录")}
            body={t("从选择一个地点开始，十秒内即可进入现场记录。")}
            action={t("开始记录")}
            onAction={() => setModal("start")}
          />
        </div>
      );
    }
    const photoCaptures = activeCaptures.filter((capture) => capture.photo_asset_id);
    return (
      <div className="live-mode">
        <header className="live-head">
          <button
            className="icon-button"
            onClick={() => setView("home")}
            aria-label={t("返回首页")}
          >
            ←
          </button>
          <div>
            <small>{t("正在记录 · {minutes} 分钟", { minutes: elapsedMinutes })}</small>
            <h1>{activeVenue.name}</h1>
            {activeExhibitions.length ? (
              <details>
                <summary>
                  {activeExhibitions.map((item: any) => item.title).join("、")}
                </summary>
                <p>{activeExhibitions.map((item: any) => t(item.exhibition_type)).join(" · ")}</p>
              </details>
            ) : (
              <p>{t("未关联展览")}</p>
            )}
          </div>
          <div className="live-state">
            <span className={online ? "online" : "local-only"}>
              {online ? t("已连接") : t("仅保存在本机")}
            </span>
            <button onClick={() => setModal("end")}>{t("结束记录")}</button>
          </div>
        </header>

        <main className="live-feed">
          <div className="live-intro">
            <span>{activeCaptures.length}</span>
            <p>{t("条旅行记录")}</p>
            <small>{t("照片与文字自动关联本次到访")}</small>
          </div>
          {uploadProgress ? (
            <div className="upload-status">
              <span style={{ width: `${uploadProgress}%` }} />
              {t("正在保存原始照片 · {progress}%", { progress: uploadProgress })}
            </div>
          ) : null}
          {failedUpload ? (
            <button
              className="retry-strip"
              onClick={() =>
                uploadFiles(failedUpload.files, failedUpload.photoType)
              }
            >
              {t("{count} 张照片尚未提交 · 点击重试", { count: failedUpload.files.length })}
            </button>
          ) : null}
          {!activeCaptures.length ? (
            <div className="live-empty">
              <p>{t("只拍一张街景、建筑或展品照片，或写一句话，也是一条完整记录。")}</p>
              <span>{t("底部操作栏适合单手使用")}</span>
            </div>
          ) : (
            <div className="live-captures">
              {activeCaptures.map((capture) => {
                const photo = photoMap.get(capture.photo_asset_id);
                const selected = photo && selectedPhotoIds.has(photo.id);
                return (
                  <article
                    key={capture.id}
                    className={`${photo ? "photo-capture" : "note-capture"} ${selected ? "selected" : ""}`}
                  >
                    {photo ? (
                      <>
                        <button
                          className="photo-select"
                          onClick={() => {
                            const next = new Set(selectedPhotoIds);
                            if (selected) next.delete(photo.id);
                            else next.add(photo.id);
                            setSelectedPhotoIds(next);
                          }}
                          aria-label={selected ? t("取消选择照片") : t("选择照片用于成组")}
                        >
                          {selected ? "✓" : "○"}
                        </button>
                        <button
                          className="live-photo"
                          onClick={() => setLightboxPhoto(photo)}
                        >
                          <img
                            src={`/api/photos/${photo.id}`}
                            alt={photo.alt_text || photo.caption || capture.capture_type}
                          />
                        </button>
                      </>
                    ) : (
                      <blockquote>“{capture.text_content}”</blockquote>
                    )}
                    <footer>
                      <span>{t(capture.capture_type)}</span>
                      {capture.is_highlight ? <b>{t("重点")}</b> : null}
                      <time>
                        {new Intl.DateTimeFormat(intlLocale(locale), {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(capture.captured_at))}
                      </time>
                      <i>{t(capture.processing_status)}</i>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
          {selectedPhotoIds.size ? (
            <button
              className="group-selection"
              onClick={createGroupFromSelection}
            >
              {t("将 {count} 张照片组成一组 →", { count: selectedPhotoIds.size })}
            </button>
          ) : photoCaptures.length > 1 ? (
            <p className="selection-hint">{t("点选照片左上角，可将街景、建筑细部、展品或说明照片组成一组。")}</p>
          ) : null}
          <div className="live-bottom-space" />
        </main>

        {modal === "capture" ? (
          <div className="capture-composer">
            <div>
              <select
                value={captureKind}
                onChange={(event) => setCaptureKind(event.target.value)}
                aria-label={t("快速记录类型")}
              >
                {["文字速记", "问题", "重点标记", "待查资料"].map((value) => (
                  <option value={value} key={value}>{t(value)}</option>
                ))}
              </select>
              <span>{online ? t("草稿在本机，提交后进档案") : t("仅保存在本机")}</span>
              <button onClick={() => setModal("")}>{t("收起")}</button>
            </div>
            <textarea
              ref={liveInputRef}
              value={liveDraft}
              onChange={(event) => setLiveDraft(event.target.value)}
              placeholder={t("写一句当下的观察、问题或感受……")}
              rows={3}
            />
            <button
              className="primary"
              disabled={!liveDraft.trim() || !online || busy}
              onClick={saveCapture}
            >
              {online ? t("保存这条记录") : t("等待网络恢复")}
            </button>
          </div>
        ) : null}

        <nav className="live-actions" aria-label={t("现场快速操作")}>
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                uploadFiles(Array.from(event.target.files || []), "travel_scene")
              }
            />
            <span>▣</span>
            <strong>{t("旅行照片")}</strong>
          </label>
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                uploadFiles(Array.from(event.target.files || []), "architecture")
              }
            />
            <span>{t("建")}</span>
            <strong>{t("街景 / 建筑")}</strong>
          </label>
          <button
            onClick={() => {
              setModal("capture");
              window.setTimeout(() => liveInputRef.current?.focus(), 60);
            }}
          >
            <span>{t("记")}</span>
            <strong>{t("写一句话")}</strong>
          </button>
          <button
            onClick={() => {
              setPendingGroupId("");
              setModal("object");
            }}
          >
            <span>＋</span>
            <strong>{t("新建对象")}</strong>
          </button>
          <button
            className={highlightNext ? "highlighted" : ""}
            onClick={() => setHighlightNext(!highlightNext)}
          >
            <span>◆</span>
            <strong>{highlightNext ? t("下条为重点") : t("标记重点")}</strong>
          </button>
        </nav>
      </div>
    );
  };

  const currentPage =
    view === "home"
      ? renderHome()
      : view === "live"
        ? renderLive()
        : view === "visits"
          ? renderVisits()
          : view === "places"
            ? renderPlaces()
            : view === "exhibitions"
              ? renderExhibitions()
              : view === "objects"
                ? renderObjects()
                : view === "inbox"
                  ? renderInbox()
                  : view === "trips"
                    ? renderTrips()
                    : view === "search"
                      ? renderSearch()
                      : view === "archive"
                        ? renderArchive()
                        : renderData();

  if (loading) {
    return (
      <main className="loading-screen">
        <span>观迹</span>
        <p>{t("正在打开你的私人档案…")}</p>
      </main>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
    <div
      className={`app-shell ${view === "live" ? "is-live" : ""}`}
      data-release="multilingual-v2"
    >
      {view !== "live" ? (
        <aside className="side-nav">
          <div className="language-switcher" role="group" aria-label={t("语言")}>
            <small>{t("语言")}</small>
            <div>
              {(["zh", "en", "fr"] as Locale[]).map((value) => (
                <button
                  key={value}
                  className={locale === value ? "active" : ""}
                  onClick={() => setLocale(value)}
                  aria-pressed={locale === value}
                >
                  {value === "zh" ? "中文" : value === "en" ? "EN" : "FR"}
                </button>
              ))}
            </div>
          </div>
          <button className="brand" onClick={() => setView("home")}>
            <span>观迹</span>
            <small>Private Field Archive</small>
          </button>
          <nav aria-label={t("主导航")}>
            {mainNav.map(([id, label]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
                data-testid={`nav-${id}`}
              >
                <span>{t(label)}</span>
                {id === "inbox" && unprocessed.length ? (
                  <b>{unprocessed.length}</b>
                ) : null}
              </button>
            ))}
          </nav>
          <button className="side-start" onClick={() => setModal("start")}>
            <i>＋</i>
            <span>{t("开始记录")}</span>
          </button>
          <div className="owner-note">
            <span className={online ? "online" : "local-only"} />
            <div>
              <strong>{online ? t("私人档案已连接") : t("当前处于弱网络")}</strong>
              <small>{online ? t("仅所有者可访问") : t("文字草稿保存在本机")}</small>
            </div>
          </div>
        </aside>
      ) : null}

      {view !== "live" ? (
        <div className="mobile-language-switcher" role="group" aria-label={t("语言")}>
          {(["zh", "en", "fr"] as Locale[]).map((value) => (
            <button
              key={value}
              className={locale === value ? "active" : ""}
              onClick={() => setLocale(value)}
              aria-pressed={locale === value}
            >
              {value === "zh" ? "中" : value.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}

      <main className="main-surface">{currentPage}</main>

      {view !== "live" ? (
        <nav className="mobile-nav" aria-label={t("移动端主导航")}>
          {[
            ["home", "概览"],
            ["visits", "到访"],
            ["inbox", "收件箱"],
            ["archive", "档案"],
            ["search", "搜索"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <span>{t(label)}</span>
              {id === "inbox" && unprocessed.length ? <b>{unprocessed.length}</b> : null}
            </button>
          ))}
          <button
            className="mobile-start"
            onClick={() => (activeVisit ? setView("live") : setModal("start"))}
            aria-label={activeVisit ? t("继续记录") : t("开始记录")}
          >
            ＋
          </button>
        </nav>
      ) : null}

      {modal === "start" ? (
        <Modal title={t("开始一次到访")} eyebrow={t("十秒进入旅行与城市记录模式")} onClose={() => setModal("")}>
          <form className="modal-form" onSubmit={startVisit}>
            <Field label={t("选择已有地点")}>
              <select name="venue_id" defaultValue="">
                <option value="">{t("快速新建地点")}</option>
                {data.venues.map((venue) => (
                  <option value={venue.id} key={venue.id}>
                    {venue.name} · {venue.city}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-separator"><span>{t("或快速新建")}</span></div>
            <Field label={t("地点名称")}>
              <input name="venue_name" placeholder={t("例如：山西博物院、建国门街区或阿那亚海边")} />
            </Field>
            <div className="form-row">
              <Field label={t("地点类型")}>
                <select name="venue_type" defaultValue="城市街区">
                  {["博物馆", "美术馆", "艺术中心", "画廊", "临时展览空间", "遗址", "石窟", "寺院", "道观", "宫殿", "园林", "古建筑", "考古现场", "城市街区", "城市街道", "城市地标", "咖啡馆或餐馆", "市场或商店", "公园或自然地点", "交通枢纽", "其他文化地点"].map((value) => (
                    <option value={value} key={value}>{t(value)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <LocationPicker locale={locale} defaultCity="" />
            {data.exhibitions.length ? (
              <fieldset className="check-grid">
                <legend>{t("关联一个或多个展览（可选）")}</legend>
                {data.exhibitions.map((exhibition) => (
                  <label key={exhibition.id}>
                    <input
                      type="checkbox"
                      name="exhibition_ids"
                      value={exhibition.id}
                    />
                    <span>
                      <strong>{exhibition.title}</strong>
                      <small>{venueMap.get(exhibition.venue_id)?.name}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <Field label={t("临时添加一个展览（可选）")}>
              <input name="new_exhibition" placeholder={t("只填标题即可")} />
            </Field>
            <p className="form-note">{t("日期和开始时间会自动记录，其他资料以后再补。")}</p>
            <button className="primary large" type="submit" disabled={busy}>
              {t("立即开始记录 →")}
            </button>
          </form>
        </Modal>
      ) : null}

      {modal === "history" ? (
        <Modal title={t("快速补录历史到访")} eyebrow={t("日期不完整也可以")} onClose={() => setModal("")}>
          <form
            className="modal-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = Object.fromEntries(new FormData(event.currentTarget).entries());
              await act("createHistoricalVisit", form);
              setModal("");
            }}
          >
            <Field label={t("已有地点")}>
              <select name="venue_id" defaultValue="">
                <option value="">{t("快速新建地点")}</option>
                {data.venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("地点名称")}>
              <input name="name" placeholder={t("使用已有地点时可留空")} />
            </Field>
            <LocationPicker locale={locale} />
            <div className="form-row">
              <Field label={t("日期精度")}>
                <select name="date_precision" defaultValue="day">
                  <option value="day">{t("精确日期")}</option>
                  <option value="month">{t("年月")}</option>
                  <option value="year">{t("年份")}</option>
                  <option value="uncertain">{t("不确定")}</option>
                </select>
              </Field>
              <Field label={t("日期")}>
                <input name="visit_date" placeholder="2022-10-03 / 2022-10 / 2022" required />
              </Field>
            </div>
              <Field label={t("展览（可空）")}><input name="exhibition_title" placeholder={t("不是展览可留空")} /></Field>
            <Field label={t("一句话说明（可空）")}><textarea name="one_sentence_summary" rows={3} /></Field>
            <Field label={t("标签（逗号分隔）")}><input name="tags" placeholder="山西, 彩塑, 想再看" /></Field>
            <button className="primary large" disabled={busy}>{t("保存历史参观")}</button>
          </form>
        </Modal>
      ) : null}

      {modal === "venue" ? (
        <Modal title={t("新建地点")} onClose={() => setModal("")}>
          <form
            className="modal-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await act("createVenue", Object.fromEntries(new FormData(event.currentTarget).entries()));
              setModal("");
            }}
          >
            <Field label={t("中文名称")}><input name="name" required /></Field>
            <Field label={t("原文名称")}><input name="original_name" /></Field>
            <Field label={t("类型")}><input name="venue_type" defaultValue="城市街区" /></Field>
            <LocationPicker locale={locale} />
            <Field label={t("整体笔记")}><textarea name="general_notes" rows={4} /></Field>
            <Field label={t("个人印象")}><textarea name="personal_impression" rows={4} /></Field>
            <button className="primary large" disabled={busy}>{t("保存地点")}</button>
          </form>
        </Modal>
      ) : null}

      {modal === "exhibition" ? (
        <Modal title={t("新建展览")} onClose={() => setModal("")}>
          <form
            className="modal-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await act("createExhibition", Object.fromEntries(new FormData(event.currentTarget).entries()));
              setModal("");
            }}
          >
            <Field label={t("展览标题")}><input name="title" required /></Field>
            <Field label={t("原文标题")}><input name="original_title" /></Field>
            <Field label={t("地点")}>
              <select name="venue_id" required>
                <option value="">{t("请选择")}</option>
                {data.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label={t("类型")}>
                <select name="exhibition_type">
                  {["临时展", "常设展", "专题陈列", "双年展或艺术节", "馆藏展", "遗址或古建中的固定展示", "其他"].map((value) => (
                    <option value={value} key={value}>{t(value)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("状态")}>
                <select name="status">
                  {["计划参观", "已经参观", "错过", "希望再看"].map((value) => (
                    <option value={value} key={value}>{t(value)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label={t("开始日期")}><input name="start_date" type="date" /></Field>
              <Field label={t("结束日期")}><input name="end_date" type="date" /></Field>
            </div>
            <Field label={t("说明")}><textarea name="description" rows={4} /></Field>
            <button className="primary large" disabled={busy}>{t("保存展览")}</button>
          </form>
        </Modal>
      ) : null}

      {modal === "trip" ? (
        <Modal title={t("创建旅程")} eyebrow={t("从问题或地点出发")} onClose={() => setModal("")}>
          <form
            className="modal-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await act("createTrip", Object.fromEntries(new FormData(event.currentTarget).entries()));
              setModal("");
            }}
          >
            <Field label={t("旅程名称")}><input name="name" placeholder={t("2026 山西城市、建筑与古迹漫游")} required /></Field>
            <Field label={t("状态")}>
              <select name="status">{["构想中", "计划中", "进行中", "已完成"].map((value) => <option value={value} key={value}>{t(value)}</option>)}</select>
            </Field>
            <LocationPicker locale={locale} />
            <div className="form-row">
              <Field label={t("开始")}><input type="date" name="start_date" /></Field>
              <Field label={t("结束")}><input type="date" name="end_date" /></Field>
            </div>
            <Field label={t("计划地点")}><textarea name="places_to_visit" rows={3} /></Field>
            <Field label={t("行前研究问题")}><textarea name="research_questions" rows={3} /></Field>
            <Field label={t("规划笔记")}><textarea name="planning_notes" rows={3} /></Field>
            <button className="primary large" disabled={busy}>{t("保存旅程")}</button>
          </form>
        </Modal>
      ) : null}

      {modal === "object" ? (
        <Modal
          title={pendingGroupId ? t("从照片组创建观察对象") : t("新建观察对象")}
          eyebrow={pendingGroupId ? t("街景、细部、展品与说明保持成组") : t("现场只填必要信息")}
          onClose={() => {
            setModal("");
            setPendingGroupId("");
          }}
          wide
        >
          <form className="modal-form object-form" onSubmit={createObject}>
            <Field label={t("名称")}>
              <input name="title" placeholder={t("例如：西安城墙南门、转角咖啡馆或未命名对象")} defaultValue="未命名对象" />
            </Field>
            <div className="form-row">
              <Field label={t("对象类型")}>
                <select name="object_type" defaultValue="其他">
                  {objectTypes.map((item) => <option value={item} key={item}>{t(item)}</option>)}
                </select>
              </Field>
              <Field label={t("核实状态")}>
                <select name="verification_status" defaultValue="用户输入">
                  {["现场铭牌", "用户输入", "待核实", "已核实"].map((value) => <option value={value} key={value}>{t(value)}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label={t("作者 / 创作者")}><input name="creator" /></Field>
              <Field label={t("文化 / 朝代")}><input name="culture_or_dynasty" /></Field>
              <Field label={t("年代")}><input name="date_display" /></Field>
            </div>
            <div className="form-row">
              <Field label={t("材料")}><input name="material" /></Field>
              <Field label={t("位置 / 街区")}><input name="gallery_or_room" /></Field>
            </div>
            <Field label={t("现场观察")}><textarea name="personal_observation" rows={4} /></Field>
            <Field label={t("现场文字 / 标识")}><textarea name="label_transcription" rows={4} /></Field>
            <Field label={t("后续研究")}><textarea name="research_notes" rows={4} /></Field>
            <button className="primary large" disabled={busy}>{t("保存观察对象")}</button>
          </form>
        </Modal>
      ) : null}

      {modal === "end" && activeVisit ? (
        <Modal title={t("结束这次记录")} eyebrow={t("所有内容都可以跳过")} onClose={() => setModal("")}>
          <div className="visit-summary">
            <div><strong>{durationText(elapsedMinutes, locale)}</strong><span>{t("停留时长")}</span></div>
            <div><strong>{visitPhotos(activeVisit.id).length}</strong><span>{t("照片")}</span></div>
            <div><strong>{activeCaptures.length}</strong><span>{t("快速记录")}</span></div>
            <div><strong>{activeCaptures.filter((item) => item.processing_status !== "已整理").length}</strong><span>{t("待整理")}</span></div>
          </div>
          <form className="modal-form" onSubmit={endVisit}>
            <Field label={t("一句话总结")}><textarea name="one_sentence_summary" rows={2} /></Field>
            <Field label={t("今天最重要的三项内容")}><textarea name="highlights" rows={3} placeholder={t("可用分号分隔")} /></Field>
            <Field label={t("一个仍然不理解的问题")}><textarea name="unresolved_questions" rows={3} /></Field>
            <Field label={t("想再来吗？")}>
              <select name="revisit_intention">{["不需要", "可能", "一定会"].map((value) => <option value={value} key={value}>{t(value)}</option>)}</select>
            </Field>
            <button className="primary large" disabled={busy}>{t("结束并进入待整理")}</button>
          </form>
        </Modal>
      ) : null}

      {importPreview ? (
        <Modal
          title={importPreview.kind === "json" ? t("确认恢复 JSON") : t("确认导入 CSV")}
          eyebrow={t("导入前预览")}
          onClose={() => setImportPreview(null)}
        >
          <div className="import-preview">
            {importPreview.kind === "json" ? (
              <dl>
                {["venues", "exhibitions", "visits", "objects", "captures", "photos", "trips"].map((key) => (
                  <div key={key}><dt>{key}</dt><dd>{Array.isArray(importPreview.archive?.[key]) ? importPreview.archive?.[key].length : 0}</dd></div>
                ))}
              </dl>
            ) : (
              <div className="preview-table">
                {(importPreview.rows || []).slice(0, 8).map((row, index) => (
                  <div key={index}>
                    <strong>{row["Venue 名称"]}</strong>
                    <span>{row["城市"]} · {row["Visit 日期"]}</span>
                    <small>{row["Exhibition 名称"] || t("无展览")}</small>
                  </div>
                ))}
              </div>
            )}
            {importPreview.errors.length ? (
              <div className="error-list">
                {importPreview.errors.map((error) => <p key={error}>{error}</p>)}
              </div>
            ) : (
              <p className="form-note">{t("同 ID 记录将跳过，不会覆盖现有内容。照片文件需另行上传。")}</p>
            )}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setImportPreview(null)}>{t("取消")}</button>
              <button className="primary" disabled={Boolean(importPreview.errors.length) || busy} onClick={confirmImport}>{t("确认导入")}</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {lightboxPhoto ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={t("查看原始照片")}>
          <button onClick={() => setLightboxPhoto(null)} aria-label={t("关闭大图")}>×</button>
          <img src={`/api/photos/${lightboxPhoto.id}`} alt={lightboxPhoto.alt_text || lightboxPhoto.caption || lightboxPhoto.original_filename} />
          <footer>
            <strong>{lightboxPhoto.original_filename}</strong>
            <span>{t(photoLabels[lightboxPhoto.photo_type])} · {(Number(lightboxPhoto.file_size) / 1024 / 1024).toFixed(1)} MB</span>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const values = Object.fromEntries(
                  new FormData(event.currentTarget).entries(),
                );
                await act("updatePhoto", {
                  id: lightboxPhoto.id,
                  photo_type: values.photo_type,
                  caption: values.caption,
                  alt_text: values.caption,
                });
                setLightboxPhoto({
                  ...lightboxPhoto,
                  photo_type: values.photo_type,
                  caption: values.caption,
                  alt_text: values.caption,
                });
              }}
            >
              <select
                name="photo_type"
                aria-label={t("照片类型")}
                defaultValue={lightboxPhoto.photo_type}
              >
                {Object.entries(photoLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
              <input
                name="caption"
                aria-label={t("照片说明")}
                defaultValue={lightboxPhoto.caption || ""}
                placeholder={t("添加说明")}
              />
              <button>{t("保存说明")}</button>
            </form>
            <a href={`/api/photos/${lightboxPhoto.id}`} download={lightboxPhoto.original_filename}>{t("下载原始照片")}</a>
          </footer>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
    </LocaleContext.Provider>
  );
}
