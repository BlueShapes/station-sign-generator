import { useState, useRef } from 'react';
import {
  Stack,
  Title,
  Text,
  Group,
  Badge,
  Button,
  ActionIcon,
  SegmentedControl,
  Modal,
  TextInput,
  Alert,
  Paper,
  Divider,
  Loader,
  Image,
  SimpleGrid,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconTrash,
  IconUpload,
  IconDownload,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconFile,
  IconPhoto,
} from '@tabler/icons-react';
import { useFontStore, type FontStatus } from '@/db/useFontStore';
import { useImageStore } from '@/db/useImageStore';
import { useTranslations } from '@/i18n/useTranslation';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status, t }: { status: FontStatus; t: (k: string) => string }) {
  switch (status) {
    case 'idle':
      return <Badge color="gray" size="sm">{t('settings.fonts.status.idle')}</Badge>;
    case 'loading':
      return (
        <Badge color="blue" size="sm" leftSection={<Loader size={10} color="blue" />}>
          {t('settings.fonts.status.loading')}
        </Badge>
      );
    case 'loaded':
      return (
        <Badge color="green" size="sm" leftSection={<IconCheck size={10} />}>
          {t('settings.fonts.status.loaded')}
        </Badge>
      );
    case 'error':
      return (
        <Badge color="red" size="sm" leftSection={<IconX size={10} />}>
          {t('settings.fonts.status.error')}
        </Badge>
      );
  }
}

export default function SettingsTab() {
  const t = useTranslations();
  const {
    storageMode, setStorageMode,
    builtinFonts, builtinStatus,
    userFonts, userFontStatus,
    preloadBuiltinFont, uploadFont, deleteUserFont, removeAllUserFonts,
  } = useFontStore();
  const { images, uploadImage, deleteImage, removeAllImages } = useImageStore(storageMode);

  // ── Font upload modal ──
  const [fontUploadOpen, { open: openFontUpload, close: closeFontUpload }] = useDisclosure(false);
  const [fontRemoveAllOpen, { open: openFontRemoveAll, close: closeFontRemoveAll }] = useDisclosure(false);
  const [selectedFont, setSelectedFont] = useState<File | null>(null);
  const [fontDisplayName, setFontDisplayName] = useState('');
  const [fontFamilyName, setFontFamilyName] = useState('');
  const [fontUploading, setFontUploading] = useState(false);
  const fontFileRef = useRef<HTMLInputElement>(null);

  // ── Image upload modal ──
  const [imgUploadOpen, { open: openImgUpload, close: closeImgUpload }] = useDisclosure(false);
  const [imgRemoveAllOpen, { open: openImgRemoveAll, close: closeImgRemoveAll }] = useDisclosure(false);
  const [selectedImg, setSelectedImg] = useState<File | null>(null);
  const [imgName, setImgName] = useState('');
  const [imgUploading, setImgUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  // ── Font handlers ──
  const handleFontFileSelect = (file: File) => {
    setSelectedFont(file);
    const base = file.name.replace(/\.[^.]+$/, '');
    setFontDisplayName(base);
    setFontFamilyName(base.replace(/\s+/g, ''));
  };

  const handleFontUploadSubmit = async () => {
    if (!selectedFont || !fontDisplayName || !fontFamilyName) return;
    setFontUploading(true);
    await uploadFont(selectedFont, fontDisplayName, fontFamilyName);
    setFontUploading(false);
    handleCloseFontUpload();
  };

  const handleCloseFontUpload = () => {
    closeFontUpload();
    setSelectedFont(null);
    setFontDisplayName('');
    setFontFamilyName('');
  };

  // ── Image handlers ──
  const handleImgFileSelect = (file: File) => {
    setSelectedImg(file);
    setImgName(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleImgUploadSubmit = async () => {
    if (!selectedImg || !imgName) return;
    setImgUploading(true);
    await uploadImage(selectedImg, imgName);
    setImgUploading(false);
    handleCloseImgUpload();
  };

  const handleCloseImgUpload = () => {
    closeImgUpload();
    setSelectedImg(null);
    setImgName('');
  };

  return (
    <Stack p="md" gap="xl" maw={640}>

      {/* ── Storage ── */}
      <Stack gap="sm">
        <Title order={4}>{t('settings.storage.title')}</Title>
        <SegmentedControl
          value={storageMode}
          onChange={(v) => setStorageMode(v as 'indexeddb' | 'memory')}
          data={[
            { label: t('settings.storage.indexeddb'), value: 'indexeddb' },
            { label: t('settings.storage.memory'), value: 'memory' },
          ]}
        />
        {storageMode === 'memory' && (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
            {t('settings.storage.memory-warning')}
          </Alert>
        )}
      </Stack>

      <Divider />

      {/* ── Pre-installed Fonts ── */}
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4}>{t('settings.fonts.builtin-title')}</Title>
          <Text size="sm" c="dimmed">{t('settings.fonts.builtin-desc')}</Text>
        </Stack>

        {builtinFonts.map((font) => (
          <Paper key={font.id} withBorder p="sm" radius="sm">
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Stack gap={2}>
                <Text size="sm" fw={500}>{font.name}</Text>
                <Text size="xs" c="dimmed" ff="monospace">{font.family}</Text>
                <Text size="xs" c="dimmed">{formatBytes(font.sizeApprox)}</Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <StatusBadge status={builtinStatus[font.id] ?? 'idle'} t={t} />
                {(builtinStatus[font.id] === 'idle' || builtinStatus[font.id] === 'error') && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconDownload size={14} />}
                    onClick={() => preloadBuiltinFont(font.id)}
                  >
                    {t('settings.fonts.preload')}
                  </Button>
                )}
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>

      <Divider />

      {/* ── Custom Fonts ── */}
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>{t('settings.fonts.user-title')}</Title>
          <Group gap="xs">
            {userFonts.length > 0 && (
              <Button size="xs" variant="subtle" color="red"
                leftSection={<IconTrash size={14} />} onClick={openFontRemoveAll}>
                {t('settings.fonts.remove-all')}
              </Button>
            )}
            <Button size="xs" leftSection={<IconUpload size={14} />} onClick={openFontUpload}>
              {t('settings.fonts.upload')}
            </Button>
          </Group>
        </Group>

        {userFonts.length === 0 ? (
          <Text size="sm" c="dimmed">{t('settings.fonts.empty')}</Text>
        ) : (
          userFonts.map((font) => (
            <Paper key={font.id} withBorder p="sm" radius="sm">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Stack gap={2}>
                  <Text size="sm" fw={500}>{font.name}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">{font.family}</Text>
                  <Text size="xs" c="dimmed">{formatBytes(font.size)}</Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  <StatusBadge status={userFontStatus[font.id] ?? 'idle'} t={t} />
                  <ActionIcon color="red" variant="subtle" size="sm"
                    onClick={() => deleteUserFont(font.id)} aria-label={t('common.delete')}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>

      <Divider />

      {/* ── Images ── */}
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>{t('settings.images.title')}</Title>
          <Group gap="xs">
            {images.length > 0 && (
              <Button size="xs" variant="subtle" color="red"
                leftSection={<IconTrash size={14} />} onClick={openImgRemoveAll}>
                {t('settings.images.remove-all')}
              </Button>
            )}
            <Button size="xs" leftSection={<IconUpload size={14} />} onClick={openImgUpload}>
              {t('settings.images.upload')}
            </Button>
          </Group>
        </Group>

        {images.length === 0 ? (
          <Text size="sm" c="dimmed">{t('settings.images.empty')}</Text>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {images.map((img) => (
              <Paper key={img.id} withBorder radius="sm" style={{ overflow: 'hidden' }}>
                <Image
                  src={img.objectUrl}
                  alt={img.name}
                  height={100}
                  fit="cover"
                />
                <Stack p="xs" gap={2}>
                  <Group justify="space-between" wrap="nowrap" gap={4}>
                    <Text size="xs" fw={500} truncate style={{ flex: 1 }}>{img.name}</Text>
                    <ActionIcon color="red" variant="subtle" size="xs"
                      onClick={() => deleteImage(img.id)} aria-label={t('common.delete')}>
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                  <Text size="xs" c="dimmed">{img.width}×{img.height}</Text>
                  <Text size="xs" c="dimmed">{formatBytes(img.size)}</Text>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </Stack>

      {/* ── Font Upload Modal ── */}
      <Modal opened={fontUploadOpen} onClose={handleCloseFontUpload} title={t('settings.fonts.upload-modal-title')}>
        <Stack>
          <input ref={fontFileRef} type="file" accept=".ttf,.otf,.woff,.woff2"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFontFileSelect(f); e.target.value = ''; }}
          />
          <Button variant={selectedFont ? 'light' : 'filled'}
            leftSection={selectedFont ? <IconFile size={14} /> : <IconUpload size={14} />}
            onClick={() => fontFileRef.current?.click()}>
            {selectedFont ? selectedFont.name : t('settings.fonts.select-file')}
          </Button>
          <TextInput label={t('settings.fonts.display-name')} value={fontDisplayName}
            onChange={(e) => setFontDisplayName(e.currentTarget.value)} required />
          <TextInput label={t('settings.fonts.family-name')} value={fontFamilyName}
            onChange={(e) => setFontFamilyName(e.currentTarget.value.replace(/\s+/g, ''))}
            description={t('settings.fonts.family-hint')} required />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleCloseFontUpload}>{t('common.cancel')}</Button>
            <Button disabled={!selectedFont || !fontDisplayName || !fontFamilyName}
              loading={fontUploading} onClick={handleFontUploadSubmit}>
              {t('settings.fonts.upload-submit')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Font Remove All Confirm ── */}
      <Modal opened={fontRemoveAllOpen} onClose={closeFontRemoveAll} title={t('settings.fonts.remove-all')}>
        <Stack>
          <Text size="sm">{t('settings.fonts.remove-all-confirm')}</Text>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={closeFontRemoveAll}>{t('common.cancel')}</Button>
            <Button color="red" onClick={async () => { await removeAllUserFonts(); closeFontRemoveAll(); }}>
              {t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Image Upload Modal ── */}
      <Modal opened={imgUploadOpen} onClose={handleCloseImgUpload} title={t('settings.images.upload-modal-title')}>
        <Stack>
          <input ref={imgFileRef} type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImgFileSelect(f); e.target.value = ''; }}
          />
          <Button variant={selectedImg ? 'light' : 'filled'}
            leftSection={selectedImg ? <IconPhoto size={14} /> : <IconUpload size={14} />}
            onClick={() => imgFileRef.current?.click()}>
            {selectedImg ? selectedImg.name : t('settings.images.select-file')}
          </Button>
          {selectedImg && (
            <Image
              src={URL.createObjectURL(selectedImg)}
              alt="preview"
              height={160}
              fit="contain"
              radius="sm"
            />
          )}
          <TextInput label={t('settings.images.display-name')} value={imgName}
            onChange={(e) => setImgName(e.currentTarget.value)} required />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleCloseImgUpload}>{t('common.cancel')}</Button>
            <Button disabled={!selectedImg || !imgName} loading={imgUploading}
              onClick={handleImgUploadSubmit}>
              {t('settings.images.upload-submit')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Image Remove All Confirm ── */}
      <Modal opened={imgRemoveAllOpen} onClose={closeImgRemoveAll} title={t('settings.images.remove-all')}>
        <Stack>
          <Text size="sm">{t('settings.images.remove-all-confirm')}</Text>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={closeImgRemoveAll}>{t('common.cancel')}</Button>
            <Button color="red" onClick={async () => { await removeAllImages(); closeImgRemoveAll(); }}>
              {t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Stack>
  );
}
