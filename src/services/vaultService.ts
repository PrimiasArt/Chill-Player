/**
 * Vault Service - AES-256-GCM In-Memory Cryptographic Media Vault
 * Protects hidden videos & audios using Web Crypto API.
 * Encrypted data is stored in IndexedDB; decryption happens in-memory on demand.
 */

import { db } from './db';
import type { MediaItem } from '../types';

export interface VaultMediaItem {
  id: string;
  title: string;
  type: 'video' | 'audio';
  duration: number;
  sizeBytes: number;
  format: string;
  encryptedBlob: Blob; // AES-256-GCM encrypted payload
  iv: string; // Base64 12-byte initialization vector
  salt: string; // Base64 16-byte PBKDF2 salt
  createdAt: number;
  lastViewedAt: number;
}

const VAULT_SALT_KEY = 'chill_vault_salt';
const VAULT_VERIFIER_KEY = 'chill_vault_verifier';
const VAULT_SESSION_KEY = 'chill_vault_session_unlocked';

class VaultService {
  private activeKey: CryptoKey | null = null;
  private memoryUrls: Map<string, string> = new Map(); // id -> blobUrl

  // Check if Vault PIN has been set up
  hasPin(): boolean {
    return !!localStorage.getItem(VAULT_VERIFIER_KEY);
  }

  // Check if session is currently unlocked
  isUnlocked(): boolean {
    return this.activeKey !== null && sessionStorage.getItem(VAULT_SESSION_KEY) === 'true';
  }

  // Convert array buffer to base64
  private buf2b64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert base64 to array buffer
  private b642buf(b64: string): ArrayBuffer {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Derive AES-256-GCM key from PIN + Salt using PBKDF2 (Optimized 25,000 iterations for instant mobile response)
  private async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 25000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate SHA-256 verifier for PIN confirmation
  private async createVerifier(pin: string, salt: Uint8Array): Promise<string> {
    const enc = new TextEncoder();
    const data = new Uint8Array(salt.length + pin.length);
    data.set(salt, 0);
    data.set(enc.encode(pin), salt.length);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.buf2b64(hash);
  }

  // Set up PIN for the first time or change PIN
  async setupPin(newPin: string): Promise<boolean> {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = this.buf2b64(salt.buffer);
      const verifier = await this.createVerifier(newPin, salt);

      localStorage.setItem(VAULT_SALT_KEY, saltB64);
      localStorage.setItem(VAULT_VERIFIER_KEY, verifier);

      // Auto unlock with new key
      this.activeKey = await this.deriveKey(newPin, salt);
      sessionStorage.setItem(VAULT_SESSION_KEY, 'true');
      return true;
    } catch (e) {
      console.error('Error setting up vault PIN:', e);
      return false;
    }
  }

  // Unlock Vault with PIN
  async unlock(pin: string): Promise<boolean> {
    try {
      const saltB64 = localStorage.getItem(VAULT_SALT_KEY);
      const storedVerifier = localStorage.getItem(VAULT_VERIFIER_KEY);
      if (!saltB64 || !storedVerifier) return false;

      const salt = new Uint8Array(this.b642buf(saltB64));
      const verifier = await this.createVerifier(pin, salt);

      if (verifier === storedVerifier) {
        this.activeKey = await this.deriveKey(pin, salt);
        sessionStorage.setItem(VAULT_SESSION_KEY, 'true');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error unlocking vault:', e);
      return false;
    }
  }

  // Lock Vault and clean memory
  lock(): void {
    this.activeKey = null;
    sessionStorage.removeItem(VAULT_SESSION_KEY);
    // Revoke all in-memory decrypted blob URLs
    this.memoryUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.memoryUrls.clear();
  }

  // Encrypt and add a file into the Vault
  async encryptAndStoreFile(file: File | Blob, title: string, format: string, duration = 0): Promise<string> {
    if (!this.activeKey) throw new Error('Vault is locked');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const rawBuffer = await file.arrayBuffer();

    // Encrypt using AES-256-GCM
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource
      },
      this.activeKey,
      rawBuffer
    );

    const isVideo = file.type.startsWith('video') || /\.(mp4|mkv|webm|avi|mov|flv|3gp|m4v)$/i.test(title);
    const id = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const vaultItem: VaultMediaItem = {
      id,
      title: title.replace(/\.[^/.]+$/, ''),
      type: isVideo ? 'video' : 'audio',
      duration,
      sizeBytes: file.size,
      format: format.toLowerCase() || (isVideo ? 'mp4' : 'mp3'),
      encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
      iv: this.buf2b64(iv.buffer),
      salt: localStorage.getItem(VAULT_SALT_KEY) || '',
      createdAt: Date.now(),
      lastViewedAt: Date.now()
    };

    await db.vaultItems.put(vaultItem);
    return id;
  }

  // Move an existing MediaItem from regular library into the Vault
  async moveItemToVault(mediaItem: MediaItem): Promise<boolean> {
    if (!this.activeKey) throw new Error('Vault is locked');
    try {
      let blob: Blob | undefined;
      if (mediaItem.fileBlob) {
        blob = mediaItem.fileBlob;
      } else {
        const blobRecord = await db.mediaBlobs.get(mediaItem.id);
        if (blobRecord && blobRecord.blob) {
          blob = blobRecord.blob;
        } else if (mediaItem.url) {
          const response = await fetch(mediaItem.url);
          blob = await response.blob();
        }
      }

      if (!blob) {
        throw new Error('Could not locate media blob to move to vault');
      }

      await this.encryptAndStoreFile(
        blob,
        mediaItem.title,
        mediaItem.format || (mediaItem.type === 'video' ? 'mp4' : 'mp3'),
        mediaItem.duration
      );

      // Permanently remove from normal public library and blob storage
      await Promise.all([
        db.mediaItems.delete(mediaItem.id),
        db.mediaBlobs.delete(mediaItem.id)
      ]);
      return true;
    } catch (e) {
      console.error('Failed to move item to vault:', e);
      return false;
    }
  }

  // Decrypt Vault item directly in RAM and produce an in-memory MediaItem for playback
  async getDecryptedMediaItem(vaultItem: VaultMediaItem): Promise<MediaItem> {
    if (!this.activeKey) throw new Error('Vault is locked');

    // Return existing memory URL if already active
    if (this.memoryUrls.has(vaultItem.id)) {
      const activeUrl = this.memoryUrls.get(vaultItem.id)!;
      return {
        id: vaultItem.id,
        title: vaultItem.title,
        url: activeUrl,
        type: vaultItem.type,
        duration: vaultItem.duration,
        currentTime: 0,
        progressPercent: 0,
        sizeBytes: vaultItem.sizeBytes,
        format: vaultItem.format,
        isFavorite: false,
        lastPlayedAt: Date.now(),
        createdAt: vaultItem.createdAt
      };
    }

    const iv = new Uint8Array(this.b642buf(vaultItem.iv));
    const encryptedArrayBuffer = await vaultItem.encryptedBlob.arrayBuffer();

    // Decrypt in RAM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource
      },
      this.activeKey,
      encryptedArrayBuffer
    );

    const mime = vaultItem.type === 'video' 
      ? `video/${vaultItem.format === 'mkv' ? 'x-matroska' : vaultItem.format}` 
      : `audio/${vaultItem.format}`;

    const decryptedBlob = new Blob([decryptedBuffer], { type: mime });
    const memoryUrl = URL.createObjectURL(decryptedBlob);
    this.memoryUrls.set(vaultItem.id, memoryUrl);

    // Update last viewed
    await db.vaultItems.update(vaultItem.id, { lastViewedAt: Date.now() });

    return {
      id: vaultItem.id,
      title: vaultItem.title,
      url: memoryUrl,
      type: vaultItem.type,
      duration: vaultItem.duration,
      currentTime: 0,
      progressPercent: 0,
      sizeBytes: vaultItem.sizeBytes,
      format: vaultItem.format,
      isFavorite: false,
      lastPlayedAt: Date.now(),
      createdAt: vaultItem.createdAt
    };
  }

  // Release decrypted memory URL when player stops
  releaseMemoryUrl(id: string): void {
    if (this.memoryUrls.has(id)) {
      const url = this.memoryUrls.get(id)!;
      URL.revokeObjectURL(url);
      this.memoryUrls.delete(id);
    }
  }

  // Delete an item from the Vault permanently
  async deleteItem(id: string): Promise<void> {
    this.releaseMemoryUrl(id);
    await db.vaultItems.delete(id);
  }

  // Restore an item from Vault back to regular library
  async restoreToLibrary(vaultItem: VaultMediaItem): Promise<boolean> {
    if (!this.activeKey) throw new Error('Vault is locked');
    try {
      const iv = new Uint8Array(this.b642buf(vaultItem.iv));
      const encryptedArrayBuffer = await vaultItem.encryptedBlob.arrayBuffer();
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        this.activeKey,
        encryptedArrayBuffer
      );
      const mime = vaultItem.type === 'video' 
        ? `video/${vaultItem.format === 'mkv' ? 'x-matroska' : vaultItem.format}` 
        : `audio/${vaultItem.format}`;
      const decryptedBlob = new Blob([decryptedBuffer], { type: mime });
      const restoredId = `local_${Date.now()}_restored`;

      // Store binary blob in dedicated mediaBlobs table
      await db.mediaBlobs.put({
        id: restoredId,
        blob: decryptedBlob
      });

      // Create regular MediaItem
      const restoredItem: MediaItem = {
        id: restoredId,
        title: vaultItem.title,
        url: '',
        type: vaultItem.type,
        duration: vaultItem.duration,
        currentTime: 0,
        progressPercent: 0,
        sizeBytes: vaultItem.sizeBytes,
        format: vaultItem.format,
        isFavorite: false,
        lastPlayedAt: Date.now(),
        createdAt: Date.now()
      };

      await db.mediaItems.put(restoredItem);
      await this.deleteItem(vaultItem.id);
      return true;
    } catch (e) {
      console.error('Failed to restore item from vault:', e);
      return false;
    }
  }

  // Get all items in vault
  async getAllVaultItems(): Promise<VaultMediaItem[]> {
    if (!this.activeKey) return [];
    return db.vaultItems.orderBy('createdAt').reverse().toArray();
  }
}

export const vaultService = new VaultService();
