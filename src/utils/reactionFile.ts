import { apiService } from '../services/api';

export function resolveReactionFileId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (raw != null && typeof raw === 'object' && 'id' in (raw as Record<string, unknown>)) {
    const id = (raw as Record<string, unknown>).id;
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    if (typeof id === 'string') {
      const parsed = Number(id);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

export async function fetchReactionCode(
  storedCode: string | undefined,
  reactionFileId: number | undefined | null,
  buildDefault: () => string,
): Promise<string> {
  let initialCode = storedCode || '';
  if (!initialCode && typeof reactionFileId === 'number') {
    try {
      initialCode = await apiService.getFile(reactionFileId);
    } catch (error) {
      console.error('Failed to fetch reaction file', error);
    }
  }
  if (!initialCode || initialCode.trim() === '') {
    initialCode = buildDefault();
  }
  return initialCode;
}

export async function persistReactionCode(
  code: string,
  reactionFileId: number | null | undefined,
): Promise<number> {
  const fileName = `reaction-${Date.now()}.reactions`;
  const file = new File([code], fileName, { type: 'text/plain;charset=utf-8' });

  if (reactionFileId == null) {
    const uploadResult = await apiService.uploadFile(file, 'REACTION');
    const newId = resolveReactionFileId(uploadResult?.data);
    if (newId == null) {
      throw new Error('Reaction file upload succeeded but did not return a file ID.');
    }
    return newId;
  }

  await apiService.updateReactionFile(reactionFileId, file);
  return reactionFileId;
}
