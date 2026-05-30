import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { take } from 'rxjs';

import { IFileDTO } from '@core/models/file.interface';
import { FilesService } from '@core/services/files.service';

interface GalleryItem {
  _id: string;
  url: string;
  uploading: boolean;
}

@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [CommonModule, IonicModule, TranslateModule],
  templateUrl: './image-picker.component.html',
  styleUrls: ['./image-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagePickerComponent implements OnInit {
  // ── Single-mode inputs ─────────────────────────────────────────────────────
  /** Existing image URL for single-mode (avatar). */
  @Input() imageUrl: string | null = null;
  /** 'circle' for avatars, 'rect' for single images. */
  @Input() shape: 'circle' | 'rect' = 'circle';

  // ── Multi-mode inputs ──────────────────────────────────────────────────────
  /** Enable gallery (multiple images) mode. */
  @Input() multi = false;
  /** Existing images to pre-populate in multi-mode. */
  @Input() existingImages: { _id: string; url: string }[] = [];

  // ── Single-mode outputs ────────────────────────────────────────────────────
  @Output() readonly fileUploaded = new EventEmitter<IFileDTO>();
  @Output() readonly fileRemoved = new EventEmitter<void>();

  // ── Multi-mode output ──────────────────────────────────────────────────────
  /** Emits the complete current list whenever an image is added or removed. */
  @Output() readonly filesChanged = new EventEmitter<{ _id: string; url: string }[]>();

  private readonly filesService = inject(FilesService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── Single-mode state ──────────────────────────────────────────────────────
  public previewUrl: string | null = null;
  public isUploading = false;

  public get displayUrl(): string | null {
    return this.previewUrl || this.imageUrl;
  }

  // ── Multi-mode state ───────────────────────────────────────────────────────
  public galleryItems: GalleryItem[] = [];

  ngOnInit(): void {
    if (this.multi) {
      this.galleryItems = this.existingImages.map(img => ({
        _id: img._id,
        url: img.url,
        uploading: false,
      }));
    }
  }

  // ── Single-mode handlers ───────────────────────────────────────────────────

  public onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);
    this.isUploading = true;
    this.cdr.markForCheck();

    this.filesService
      .uploadFile(fd)
      .pipe(take(1))
      .subscribe({
        next: (dto) => {
          this.isUploading = false;
          this.previewUrl = dto.url;
          this.fileUploaded.emit(dto);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isUploading = false;
          this.previewUrl = null;
          this.cdr.markForCheck();
        },
      });

    input.value = '';
  }

  public remove(): void {
    this.previewUrl = null;
    this.fileRemoved.emit();
  }

  // ── Multi-mode handlers ────────────────────────────────────────────────────

  public onFileChangeMulti(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    files.forEach(file => this.uploadToGallery(file));
    input.value = '';
  }

  public removeMulti(index: number): void {
    this.galleryItems = this.galleryItems.filter((_, i) => i !== index);
    this.emitFilesChanged();
    this.cdr.markForCheck();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private uploadToGallery(file: File): void {
    const tempId = `temp_${Date.now()}_${Math.random()}`;

    // Add placeholder with local preview.
    const newItem: GalleryItem = { _id: tempId, url: '', uploading: true };
    this.galleryItems = [...this.galleryItems, newItem];
    this.cdr.markForCheck();

    const reader = new FileReader();
    reader.onload = () => {
      this.galleryItems = this.galleryItems.map(item =>
        item._id === tempId ? { ...item, url: reader.result as string } : item,
      );
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);

    this.filesService
      .uploadFile(fd)
      .pipe(take(1))
      .subscribe({
        next: (dto) => {
          this.galleryItems = this.galleryItems.map(item =>
            item._id === tempId ? { _id: dto._id, url: dto.url, uploading: false } : item,
          );
          this.emitFilesChanged();
          this.cdr.markForCheck();
        },
        error: () => {
          this.galleryItems = this.galleryItems.filter(item => item._id !== tempId);
          this.emitFilesChanged();
          this.cdr.markForCheck();
        },
      });
  }

  private emitFilesChanged(): void {
    this.filesChanged.emit(
      this.galleryItems
        .filter(item => !item.uploading)
        .map(({ _id, url }) => ({ _id, url })),
    );
  }
}
