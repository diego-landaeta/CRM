import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/modules/leads/api/audiences.api', () => ({
  uploadAudienceToMeta: vi.fn(),
  getMetaUploadStatus: vi.fn(),
  getMetaUploadHistory: vi.fn(),
}));

import { useMetaUpload } from '@/modules/leads/hooks/useMetaUpload';
import {
  uploadAudienceToMeta,
  getMetaUploadStatus,
  getMetaUploadHistory,
} from '@/modules/leads/api/audiences.api';

const sampleHistory = [
  { audienceId: 'a1', audienceName: 'Demo', recordsUploaded: 100, matchRate: 75, status: 'completed', uploadedAt: '2026-01-01T00:00:00Z' },
];

describe('useMetaUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMetaUploadHistory.mockResolvedValue({ success: true, data: sampleHistory });
  });

  it('estado inicial: upload null, error null', () => {
    const { result } = renderHook(() => useMetaUpload(1));
    expect(result.current.upload).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('carga historial al montar con projectId', async () => {
    const { result } = renderHook(() => useMetaUpload(1));
    await waitFor(() => expect(getMetaUploadHistory).toHaveBeenCalledWith(1));
    await waitFor(() => expect(result.current.history).toEqual(sampleHistory));
  });

  it('NO carga historial si projectId es null', () => {
    renderHook(() => useMetaUpload(null));
    expect(getMetaUploadHistory).not.toHaveBeenCalled();
  });

  it('startUpload exitoso setea upload y devuelve data', async () => {
    uploadAudienceToMeta.mockResolvedValue({
      success: true,
      data: { uploadId: 'up_1', status: 'preparing', audienceId: 'aud_1', audienceName: 'X', recordsUploaded: 50 },
    });
    const { result } = renderHook(() => useMetaUpload(1));
    let r;
    await act(async () => { r = await result.current.startUpload({ filters: { statuses: ['nuevo'] } }); });
    expect(uploadAudienceToMeta).toHaveBeenCalledWith({ projectId: 1, filters: { statuses: ['nuevo'] }, audienceId: undefined });
    expect(r.uploadId).toBe('up_1');
    expect(result.current.upload?.uploadId).toBe('up_1');
  });

  it('startUpload con audienceId existente lo pasa al API', async () => {
    uploadAudienceToMeta.mockResolvedValue({
      success: true,
      data: { uploadId: 'up_1', status: 'preparing' },
    });
    const { result } = renderHook(() => useMetaUpload(1));
    await act(async () => { await result.current.startUpload({ filters: {}, audienceId: 'aud_existing' }); });
    expect(uploadAudienceToMeta).toHaveBeenCalledWith({ projectId: 1, filters: {}, audienceId: 'aud_existing' });
  });

  it('startUpload con error: setea error y throws', async () => {
    uploadAudienceToMeta.mockResolvedValue({ success: false, error: 'Audiencia muy pequeña' });
    const { result } = renderHook(() => useMetaUpload(1));
    let caught;
    await act(async () => {
      try { await result.current.startUpload({ filters: {} }); }
      catch (e) { caught = e; }
    });
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toBe('Audiencia muy pequeña');
    expect(result.current.error).toBe('Audiencia muy pequeña');
    expect(result.current.upload).toBeNull();
  });

  it('reset limpia upload + error', async () => {
    uploadAudienceToMeta.mockResolvedValue({
      success: true,
      data: { uploadId: 'up_1', status: 'preparing' },
    });
    const { result } = renderHook(() => useMetaUpload(1));
    await act(async () => { await result.current.startUpload({ filters: {} }); });
    expect(result.current.upload).not.toBeNull();
    act(() => result.current.reset());
    expect(result.current.upload).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('refreshHistory recarga el historial', async () => {
    const { result } = renderHook(() => useMetaUpload(1));
    await waitFor(() => expect(getMetaUploadHistory).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.refreshHistory(); });
    expect(getMetaUploadHistory).toHaveBeenCalledTimes(2);
  });

  it('polling avanza status hasta completed', async () => {
    uploadAudienceToMeta.mockResolvedValue({
      success: true,
      data: { uploadId: 'up_1', status: 'preparing' },
    });
    let pollCount = 0;
    getMetaUploadStatus.mockImplementation(async () => {
      pollCount++;
      const flow = ['uploading', 'processing', 'completed'];
      return { success: true, data: { uploadId: 'up_1', status: flow[Math.min(pollCount - 1, 2)] } };
    });

    const { result } = renderHook(() => useMetaUpload(1));
    await act(async () => { await result.current.startUpload({ filters: {} }); });

    await waitFor(() => expect(result.current.upload?.status).toBe('completed'), { timeout: 8000 });
    expect(pollCount).toBeGreaterThanOrEqual(3);
  }, 10000);

  it('al completarse refresca historial automáticamente', async () => {
    uploadAudienceToMeta.mockResolvedValue({
      success: true,
      data: { uploadId: 'up_1', status: 'preparing' },
    });
    getMetaUploadStatus.mockResolvedValue({ success: true, data: { uploadId: 'up_1', status: 'completed' } });

    const { result } = renderHook(() => useMetaUpload(1));
    await waitFor(() => expect(getMetaUploadHistory).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.startUpload({ filters: {} }); });
    await waitFor(() => expect(result.current.upload?.status).toBe('completed'), { timeout: 5000 });
    await waitFor(() => expect(getMetaUploadHistory).toHaveBeenCalledTimes(2), { timeout: 5000 });
  }, 10000);

  it('polling setea error si la API responde success:false', async () => {
    uploadAudienceToMeta.mockResolvedValue({
      success: true,
      data: { uploadId: 'up_1', status: 'preparing' },
    });
    getMetaUploadStatus.mockResolvedValue({ success: false, error: 'Upload no encontrado' });

    const { result } = renderHook(() => useMetaUpload(1));
    await act(async () => { await result.current.startUpload({ filters: {} }); });
    await waitFor(() => expect(result.current.error).toBe('Upload no encontrado'), { timeout: 5000 });
  }, 10000);
});
