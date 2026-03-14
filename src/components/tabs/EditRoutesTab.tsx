import { useState } from "react";
import type { Database } from "sql.js";
import {
  Button,
  Box,
  Stack,
  Text,
  Group,
  Title,
  Select,
  TextInput,
  NumberInput,
  ColorInput,
  Modal,
  Badge,
  ActionIcon,
  Loader,
  Center,
  Switch,
  Divider,
  Table,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDownload,
  IconArrowUp,
  IconArrowDown,
} from "@tabler/icons-react";
import { v7 as uuidv7 } from "uuid";
import { useTranslations } from "@/i18n/useTranslation";
import { downloadDatabase } from "@/db/init";
import { getAllCompanies, upsertCompany, deleteCompany } from "@/db/repositories/companies";
import { getAllLines, upsertLine, deleteLine } from "@/db/repositories/lines";
import {
  getStationsByLine,
  upsertStation,
  deleteStationFromLine,
  getStationLines,
  upsertStationLine,
  getStationNumbers,
  upsertStationNumber,
  deleteStationNumber,
  getStationAreas,
  syncStationAreas,
} from "@/db/repositories/stations";
import type { Company, Line, Station, StationArea } from "@/db/types";

interface EditRoutesTabProps {
  db: Database | null;
  persist: () => void;
}

// ── Company Form Modal ────────────────────────────────────────────────────────

interface CompanyFormProps {
  db: Database;
  company?: Company;
  onSave: () => void;
  onClose: () => void;
}

function CompanyForm({ db, company, onSave, onClose }: CompanyFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(company?.name ?? "");
  const [color, setColor] = useState(company?.company_color ?? "#36ab33");

  const handleSave = () => {
    if (!name.trim()) return;
    upsertCompany(db, {
      id: company?.id ?? uuidv7(),
      name: name.trim(),
      company_color: color,
    });
    onSave();
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.company.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <ColorInput
        label={t("route.company.color")}
        value={color}
        onChange={setColor}
        format="hex"
        swatches={["#36ab33", "#005bac", "#e60012", "#f97f00", "#000000", "#ffffff"]}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>{t("common.close")}</Button>
        <Button onClick={handleSave} disabled={!name.trim()}>{t("common.save")}</Button>
      </Group>
    </Stack>
  );
}

// ── Line Form Modal ───────────────────────────────────────────────────────────

interface LineFormProps {
  db: Database;
  line?: Line;
  companies: Company[];
  onSave: () => void;
  onClose: () => void;
}

function LineForm({ db, line, companies, onSave, onClose }: LineFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(line?.name ?? "");
  const [prefix, setPrefix] = useState(line?.prefix ?? "");
  const [color, setColor] = useState(line?.line_color ?? "#89ff12");
  const [companyId, setCompanyId] = useState<string | null>(line?.company_id ?? null);
  const [priority, setPriority] = useState<number | string>(line?.priority ?? "");

  const handleSave = () => {
    if (!name.trim() || !prefix.trim()) return;
    upsertLine(db, {
      id: line?.id ?? uuidv7(),
      name: name.trim(),
      prefix: prefix.trim(),
      line_color: color,
      company_id: companyId,
      priority: priority === "" ? null : Number(priority),
    });
    onSave();
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.line.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextInput
        label={t("route.line.prefix")}
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        required
      />
      <ColorInput
        label={t("route.line.color")}
        value={color}
        onChange={setColor}
        format="hex"
        swatches={["#89ff12", "#ffffff", "#000000", "#ffdd00", "#f97f00"]}
      />
      <Select
        label={t("route.line.company")}
        value={companyId}
        onChange={setCompanyId}
        data={companies.map((c) => ({ value: c.id, label: c.name }))}
        clearable
        placeholder="—"
      />
      <NumberInput
        label={t("route.line.priority")}
        value={priority}
        onChange={setPriority}
        placeholder="—"
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>{t("common.close")}</Button>
        <Button onClick={handleSave} disabled={!name.trim() || !prefix.trim()}>{t("common.save")}</Button>
      </Group>
    </Stack>
  );
}

// ── Station Form Modal ────────────────────────────────────────────────────────

interface StationFormProps {
  db: Database;
  station?: Station;
  lineId: string;
  maxSortOrder: number;
  onSave: () => void;
  onClose: () => void;
}

function StationForm({ db, station, lineId, maxSortOrder, onSave, onClose }: StationFormProps) {
  const t = useTranslations();

  const existingNums = station
    ? getStationNumbers(db, station.id, lineId)
    : [];
  const existingAreas = station ? getStationAreas(db, station.id) : [];

  const [primaryName, setPrimaryName] = useState(station?.primary_name ?? "");
  const [furigana, setFurigana] = useState(station?.primary_name_furigana ?? "");
  const [secondaryName, setSecondaryName] = useState(station?.secondary_name ?? "");
  const [tertiaryName, setTertiaryName] = useState(station?.tertiary_name ?? "");
  const [quaternaryName, setQuaternaryName] = useState(station?.quaternary_name ?? "");
  const [note, setNote] = useState(station?.note ?? "");
  const [trc, setTrc] = useState(station?.three_letter_code ?? "");
  const [stationNumber, setStationNumber] = useState(existingNums[0]?.value ?? "");
  const [areas, setAreas] = useState<StationArea[]>(existingAreas);

  const handleSave = () => {
    if (!primaryName.trim()) return;

    const stationId = station?.id ?? uuidv7();

    // Upsert station
    upsertStation(db, {
      id: stationId,
      primary_name: primaryName.trim(),
      primary_name_furigana: furigana.trim() || null,
      secondary_name: secondaryName.trim() || null,
      tertiary_name: tertiaryName.trim() || null,
      quaternary_name: quaternaryName.trim() || null,
      quinary_name: null,
      note: note.trim() || null,
      three_letter_code: trc.trim() || null,
      sort_order: station?.sort_order ?? null,
    });

    // If new station, add to line
    if (!station) {
      upsertStationLine(db, {
        id: uuidv7(),
        station_id: stationId,
        line_id: lineId,
        sort_order: maxSortOrder + 1,
      });
    }

    // Upsert station number for this line
    if (stationNumber.trim()) {
      // Delete existing numbers for this station+line
      db.run(`DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`, [stationId, lineId]);
      upsertStationNumber(db, {
        id: uuidv7(),
        station_id: stationId,
        line_id: lineId,
        value: stationNumber.trim(),
      });
    } else {
      db.run(`DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`, [stationId, lineId]);
    }

    // Sync areas
    syncStationAreas(db, stationId, areas.map((a, i) => ({ ...a, sort_order: i })));

    onSave();
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.station.name")}
        value={primaryName}
        onChange={(e) => setPrimaryName(e.target.value)}
        required
      />
      <TextInput
        label={t("route.station.furigana")}
        value={furigana}
        onChange={(e) => setFurigana(e.target.value)}
      />
      <TextInput
        label={t("route.station.en")}
        value={secondaryName}
        onChange={(e) => setSecondaryName(e.target.value)}
      />
      <TextInput
        label={t("route.station.ko")}
        value={tertiaryName}
        onChange={(e) => setTertiaryName(e.target.value)}
      />
      <TextInput
        label={t("route.station.zh")}
        value={quaternaryName}
        onChange={(e) => setQuaternaryName(e.target.value)}
      />
      <TextInput
        label={t("route.station.note")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <TextInput
        label={t("route.station.trc")}
        value={trc}
        onChange={(e) => setTrc(e.target.value)}
        maxLength={3}
      />
      <TextInput
        label={t("route.station.number")}
        value={stationNumber}
        onChange={(e) => setStationNumber(e.target.value)}
      />

      <Divider label={t("route.station.areas")} labelPosition="left" />
      <Stack gap="xs">
        {areas.map((area) => (
          <Group key={area.id} gap="xs" align="center" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              value={area.name}
              onChange={(e) =>
                setAreas((prev) =>
                  prev.map((a) => (a.id === area.id ? { ...a, name: e.target.value } : a)),
                )
              }
            />
            <Switch
              checked={area.is_white === 1}
              onChange={() =>
                setAreas((prev) =>
                  prev.map((a) =>
                    a.id === area.id ? { ...a, is_white: a.is_white === 1 ? 0 : 1 } : a,
                  ),
                )
              }
            />
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => setAreas((prev) => prev.filter((a) => a.id !== area.id))}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            setAreas((prev) => [
              ...prev,
              {
                id: uuidv7(),
                station_id: station?.id ?? "",
                name: "",
                is_white: 0,
                sort_order: prev.length,
              },
            ])
          }
        >
          {t("common.add")}
        </Button>
      </Stack>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>{t("common.close")}</Button>
        <Button onClick={handleSave} disabled={!primaryName.trim()}>{t("common.save")}</Button>
      </Group>
    </Stack>
  );
}

// ── Main EditRoutesTab ────────────────────────────────────────────────────────

export default function EditRoutesTab({ db, persist }: EditRoutesTabProps) {
  const t = useTranslations();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    persist();
    setRefreshKey((k) => k + 1);
  };

  // Company state
  const [companyModalOpened, { open: openCompanyModal, close: closeCompanyModal }] = useDisclosure(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);

  // Line state
  const [lineModalOpened, { open: openLineModal, close: closeLineModal }] = useDisclosure(false);
  const [editingLine, setEditingLine] = useState<Line | undefined>(undefined);
  const [lineCompanyFilter, setLineCompanyFilter] = useState<string | null>(null);

  // Station state
  const [stationModalOpened, { open: openStationModal, close: closeStationModal }] = useDisclosure(false);
  const [editingStation, setEditingStation] = useState<Station | undefined>(undefined);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  if (!db) {
    return (
      <Center style={{ height: "300px" }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">{t("common.loading")}</Text>
        </Stack>
      </Center>
    );
  }

  // Read data from DB (re-reads on refreshKey change)
  const companies = getAllCompanies(db);
  const allLines = getAllLines(db);
  const filteredLines = lineCompanyFilter
    ? allLines.filter((l) => l.company_id === lineCompanyFilter)
    : allLines;
  const stationsInLine = selectedLineId ? getStationsByLine(db, selectedLineId) : [];
  const selectedLine = allLines.find((l) => l.id === selectedLineId);

  const handleDeleteCompany = (id: string) => {
    if (!window.confirm(t("route.company.delete-confirm"))) return;
    deleteCompany(db, id);
    refresh();
  };

  const handleDeleteLine = (id: string) => {
    if (!window.confirm(t("route.line.delete-confirm"))) return;
    deleteLine(db, id);
    refresh();
  };

  const handleDeleteStation = (stationId: string) => {
    if (!selectedLineId) return;
    if (!window.confirm(t("route.station.delete-confirm"))) return;
    deleteStationFromLine(db, stationId, selectedLineId);
    refresh();
  };

  const handleReorderStation = (stationId: string, direction: "up" | "down") => {
    if (!selectedLineId) return;
    const stationLines = stationsInLine.map((s) => {
      const sls = getStationLines(db, s.id);
      return sls.find((sl) => sl.line_id === selectedLineId);
    }).filter(Boolean);

    const idx = stationLines.findIndex((sl) => sl!.station_id === stationId);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stationLines.length) return;

    const a = stationLines[idx]!;
    const b = stationLines[swapIdx]!;

    // Swap sort_orders
    const tempOrder = a.sort_order;
    upsertStationLine(db, { ...a, sort_order: b.sort_order });
    upsertStationLine(db, { ...b, sort_order: tempOrder });

    refresh();
  };

  const maxSortOrder =
    stationsInLine.length > 0
      ? Math.max(
          ...stationsInLine.map((s) => {
            const sls = getStationLines(db, s.id);
            const sl = sls.find((sl) => sl.line_id === selectedLineId);
            return sl?.sort_order ?? 0;
          }),
        )
      : 0;

  return (
    <Box style={{ padding: "16px" }}>
      {/* Download SQLite button */}
      <Group justify="flex-end" mb="lg">
        <Button
          variant="outline"
          leftSection={<IconDownload size={16} />}
          onClick={() => downloadDatabase(db, "station-signs.sqlite")}
        >
          {t("route.download-sqlite")}
        </Button>
      </Group>

      <Stack gap="xl">
        {/* ── Companies section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.company.title")}</Title>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingCompany(undefined);
                openCompanyModal();
              }}
            >
              {t("route.company.add")}
            </Button>
          </Group>

          {companies.length === 0 ? (
            <Text c="dimmed" size="sm">{t("route.company.empty")}</Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("route.company.name")}</Table.Th>
                  <Table.Th>{t("route.company.color")}</Table.Th>
                  <Table.Th style={{ width: 100 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {companies.map((company) => (
                  <Table.Tr key={company.id}>
                    <Table.Td>{company.name}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Box
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            backgroundColor: company.company_color,
                            border: "1px solid #ccc",
                          }}
                        />
                        <Text size="sm">{company.company_color}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEditingCompany(company);
                            openCompanyModal();
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteCompany(company.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        <Divider />

        {/* ── Lines section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.line.title")}</Title>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingLine(undefined);
                openLineModal();
              }}
            >
              {t("route.line.add")}
            </Button>
          </Group>

          <Select
            label={t("route.line.company")}
            value={lineCompanyFilter}
            onChange={setLineCompanyFilter}
            data={[
              { value: "", label: t("route.line.all") },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
            mb="md"
            clearable
            placeholder={t("route.line.all")}
          />

          {filteredLines.length === 0 ? (
            <Text c="dimmed" size="sm">{t("route.line.empty")}</Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("route.line.name")}</Table.Th>
                  <Table.Th>{t("route.line.prefix")}</Table.Th>
                  <Table.Th>{t("route.line.color")}</Table.Th>
                  <Table.Th>{t("route.line.company")}</Table.Th>
                  <Table.Th style={{ width: 100 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredLines.map((line) => {
                  const company = companies.find((c) => c.id === line.company_id);
                  return (
                    <Table.Tr key={line.id}>
                      <Table.Td>{line.name}</Table.Td>
                      <Table.Td>
                        <Badge variant="outline">{line.prefix}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Box
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              backgroundColor: line.line_color,
                              border: "1px solid #ccc",
                            }}
                          />
                          <Text size="sm">{line.line_color}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>{company?.name ?? "—"}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setEditingLine(line);
                              openLineModal();
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteLine(line.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        <Divider />

        {/* ── Stations section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.station.title")}</Title>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              disabled={!selectedLineId}
              onClick={() => {
                setEditingStation(undefined);
                openStationModal();
              }}
            >
              {t("route.station.add")}
            </Button>
          </Group>

          <Select
            label={t("route.line.title")}
            value={selectedLineId}
            onChange={setSelectedLineId}
            data={allLines.map((l) => ({
              value: l.id,
              label: `[${l.prefix}] ${l.name}`,
            }))}
            placeholder={t("route.line.select")}
            mb="md"
            clearable
          />

          {!selectedLineId ? (
            <Text c="dimmed" size="sm">{t("route.station.empty")}</Text>
          ) : stationsInLine.length === 0 ? (
            <Text c="dimmed" size="sm">{t("route.station.no-station")}</Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 60 }}>#</Table.Th>
                  <Table.Th>{t("route.station.name")}</Table.Th>
                  <Table.Th>{t("route.station.number")}</Table.Th>
                  <Table.Th style={{ width: 140 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stationsInLine.map((station, idx) => {
                  const nums = getStationNumbers(db, station.id, selectedLineId!);
                  return (
                    <Table.Tr key={station.id}>
                      <Table.Td>
                        <Badge variant="light" size="sm">{idx + 1}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text size="sm" fw={600}>{station.primary_name}</Text>
                          {station.primary_name_furigana && (
                            <Text size="xs" c="dimmed">{station.primary_name_furigana}</Text>
                          )}
                          {station.secondary_name && (
                            <Text size="xs" c="dimmed">{station.secondary_name}</Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {nums[0]?.value ? (
                          <Badge>{nums[0].value}</Badge>
                        ) : (
                          <Text size="sm" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            disabled={idx === 0}
                            onClick={() => handleReorderStation(station.id, "up")}
                          >
                            <IconArrowUp size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            disabled={idx === stationsInLine.length - 1}
                            onClick={() => handleReorderStation(station.id, "down")}
                          >
                            <IconArrowDown size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setEditingStation(station);
                              openStationModal();
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteStation(station.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Box>
      </Stack>

      {/* ── Modals ── */}
      <Modal
        opened={companyModalOpened}
        onClose={closeCompanyModal}
        title={editingCompany ? t("route.company.edit") : t("route.company.add")}
        centered
      >
        <CompanyForm
          db={db}
          company={editingCompany}
          onSave={refresh}
          onClose={closeCompanyModal}
        />
      </Modal>

      <Modal
        opened={lineModalOpened}
        onClose={closeLineModal}
        title={editingLine ? t("route.line.edit") : t("route.line.add")}
        centered
      >
        <LineForm
          db={db}
          line={editingLine}
          companies={companies}
          onSave={refresh}
          onClose={closeLineModal}
        />
      </Modal>

      {selectedLine && (
        <Modal
          opened={stationModalOpened}
          onClose={closeStationModal}
          title={editingStation ? t("route.station.edit") : t("route.station.add")}
          centered
          size="lg"
        >
          <StationForm
            db={db}
            station={editingStation}
            lineId={selectedLine.id}
            maxSortOrder={maxSortOrder}
            onSave={refresh}
            onClose={closeStationModal}
          />
        </Modal>
      )}
    </Box>
  );
}
