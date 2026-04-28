import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoaderService {
  public isLoading = signal<boolean>(false);

  private requestCount = 0;

  public show(): void {
    this.requestCount++;
    if (this.requestCount === 1) {
      this.isLoading.set(true);
    }
  }

  public hide(): void {
    if (this.requestCount > 0) {
      this.requestCount--;
    }
    if (this.requestCount === 0) {
      this.isLoading.set(false);
    }
  }
}

