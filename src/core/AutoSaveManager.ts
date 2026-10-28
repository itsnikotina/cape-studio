import type { DocumentModel } from './DocumentModel';
import {
  ProjectStorage,
  serializeDocument,
  type SerializedProject,
  AUTOSAVE_STORAGE_KEY,
} from './ProjectStorage';

export type AutoSaveStatusType = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface AutoSaveStatus {
  type: AutoSaveStatusType;
  lastSavedAt: number | null;
  errorMessage: string | null;
  sequence: number;
}

export class AutoSaveManager {
  private storage: ProjectStorage;
  private debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private sequenceCounter = 0;
  private lastCompletedSequence = -1;
  private inFlightSaveCount = 0;
  private currentStatus: AutoSaveStatus = {
    type: 'idle',
    lastSavedAt: null,
    errorMessage: null,
    sequence: 0,
  };
  private listeners = new Set<(status: AutoSaveStatus) => void>();

  constructor(storage?: ProjectStorage, debounceMs = 600) {
    this.storage = storage || new ProjectStorage();
    this.debounceMs = debounceMs;
  }

  getStorage(): ProjectStorage {
    return this.storage;
  }

  getStatus(): AutoSaveStatus {
    return { ...this.currentStatus };
  }

  subscribe(listener: (status: AutoSaveStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(update: Partial<AutoSaveStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...update };
    for (const listener of this.listeners) {
      listener(this.getStatus());
    }
  }

  /**
   * Schedules a debounced auto-save. Protects against rapid successive modifications.
   */
  scheduleSave(doc: DocumentModel, docName: string, description = 'Modificação'): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.setStatus({ type: 'unsaved' });

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.performSave(doc, docName, description);
    }, this.debounceMs);
  }

  /**
   * Immediately triggers pending save or performs explicit save
   */
  async flush(doc: DocumentModel, docName: string, description = 'Salvar Imediato'): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    return await this.performSave(doc, docName, description);
  }

  /**
   * Internal save execution with out-of-order write protection
   */
  private async performSave(
    doc: DocumentModel,
    docName: string,
    description: string
  ): Promise<boolean> {
    const sequence = ++this.sequenceCounter;
    const project = serializeDocument(doc, docName, sequence, description);

    this.inFlightSaveCount++;
    this.setStatus({ type: 'saving', sequence });

    try {
      await this.storage.saveProject(project, AUTOSAVE_STORAGE_KEY);

      // Guard against out-of-order writes
      if (sequence >= this.lastCompletedSequence) {
        this.lastCompletedSequence = sequence;
        this.setStatus({
          type: 'saved',
          lastSavedAt: Date.now(),
          errorMessage: null,
          sequence,
        });
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida ao salvar';
      this.setStatus({
        type: 'error',
        errorMessage: message,
      });
      return false;
    } finally {
      this.inFlightSaveCount = Math.max(0, this.inFlightSaveCount - 1);
    }
  }

  /**
   * Checks whether a recoverable project is present in persistent storage
   */
  async hasRecoverableProject(): Promise<boolean> {
    try {
      return await this.storage.hasProject(AUTOSAVE_STORAGE_KEY);
    } catch {
      return false;
    }
  }

  /**
   * Loads the recoverable project from storage
   */
  async loadRecoverableProject(): Promise<SerializedProject | null> {
    try {
      return await this.storage.loadProject(AUTOSAVE_STORAGE_KEY);
    } catch (err) {
      this.setStatus({
        type: 'error',
        errorMessage: err instanceof Error ? err.message : 'Falha ao carregar projeto recuperável',
      });
      return null;
    }
  }

  /**
   * Clears the auto-saved project from persistent storage
   */
  async clearRecoverableProject(): Promise<void> {
    try {
      await this.storage.clearProject(AUTOSAVE_STORAGE_KEY);
      this.setStatus({
        type: 'idle',
        lastSavedAt: null,
        errorMessage: null,
        sequence: 0,
      });
    } catch (err) {
      this.setStatus({
        type: 'error',
        errorMessage: err instanceof Error ? err.message : 'Falha ao limpar projeto salvo',
      });
    }
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.listeners.clear();
  }
}
