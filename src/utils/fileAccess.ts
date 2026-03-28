/**
 * browser-fs-access 래핑.
 * File System Access API 지원 시 네이티브 피커, 미지원 시 폴백.
 */

import { fileSave } from 'browser-fs-access';

/**
 * Blob을 파일로 저장.
 * File System Access API 지원 시 showSaveFilePicker,
 * 미지원 시 browser-fs-access의 fileSave 폴백 (a download 방식).
 */
export async function saveBlob(
  blob: Blob,
  suggestedName: string,
): Promise<void> {
  const ext = suggestedName.endsWith('.zip') ? '.zip' : '.png';
  await fileSave(blob, {
    fileName: suggestedName,
    extensions: [ext],
  });
}

/**
 * File System Access API의 showDirectoryPicker로 폴더 선택 후 각 파일을 저장.
 * 미지원 시 각 파일을 순차적으로 다운로드 (200ms 간격).
 */
export async function saveBlobsToDirectory(
  files: Record<string, Blob>,
): Promise<void> {
  if ('showDirectoryPicker' in window) {
    const dirHandle = await (
      window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    ).showDirectoryPicker();

    for (const [name, blob] of Object.entries(files)) {
      const fileHandle = await dirHandle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }
  } else {
    const entries = Object.entries(files);
    for (let i = 0; i < entries.length; i++) {
      const [name, blob] = entries[i];
      await fileSave(blob, { fileName: name, extensions: ['.png'] });
      if (i < entries.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
}
